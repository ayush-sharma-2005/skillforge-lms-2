import mongoose from "mongoose";
import { Submission, type ISimilarityReport, type ISimilarityMatch } from "./submission.model";
import { Assignment } from "./assignment.model";

/**
 * Tokenizes text into word-based n-grams (shingles).
 */
export function getWordNGrams(text: string, n = 3): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter((w) => w.length > 0);
  const ngrams = new Set<string>();

  if (words.length < n) {
    if (words.length > 0) {
      ngrams.add(words.join(" "));
    }
    return ngrams;
  }

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }

  return ngrams;
}

/**
 * Calculates Jaccard similarity between two sets of n-grams (0 to 100 percentage).
 */
export function calculateJaccardSimilarity(
  setA: Set<string>,
  setB: Set<string>
): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;

  return Math.round((intersectionSize / unionSize) * 10000) / 100;
}

/**
 * Identifies overlapping text passages between two pieces of text.
 */
export function extractMatchingPassages(
  textA: string,
  textB: string,
  minTokens = 4
): string[] {
  const wordsA = textA
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const wordsB = textB
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const passageSet = new Set<string>();
  const bLookup = new Set<string>();

  for (let i = 0; i <= wordsB.length - minTokens; i++) {
    bLookup.add(wordsB.slice(i, i + minTokens).join(" "));
  }

  for (let i = 0; i <= wordsA.length - minTokens; i++) {
    const candidate = wordsA.slice(i, i + minTokens).join(" ");
    if (bLookup.has(candidate)) {
      passageSet.add(candidate);
      if (passageSet.size >= 5) break; // Limit to top 5 excerpts
    }
  }

  return Array.from(passageSet);
}

/**
 * Runs similarity analysis across cohort submissions for an assignment.
 * Generates and stores similarity report on the submission without automatically penalizing.
 */
export async function runPlagiarismCheck(
  submissionId: string | mongoose.Types.ObjectId
): Promise<ISimilarityReport> {
  const currentSubmission = await Submission.findById(submissionId);
  if (!currentSubmission) {
    throw new Error("Submission not found");
  }

  const assignment = await Assignment.findById(currentSubmission.assignment);
  const threshold = assignment?.similarityThreshold ?? 40;

  // Find all other submissions for the same assignment
  const cohortSubmissions = await Submission.find({
    assignment: currentSubmission.assignment,
    _id: { $ne: currentSubmission._id },
  }).select("_id student content");

  const currentNgrams = getWordNGrams(currentSubmission.content, 3);
  const matches: ISimilarityMatch[] = [];
  let highestScore = 0;

  for (const other of cohortSubmissions) {
    const otherNgrams = getWordNGrams(other.content, 3);
    const score = calculateJaccardSimilarity(currentNgrams, otherNgrams);

    if (score > 5) {
      // Record any discernible similarity
      const passages = extractMatchingPassages(
        currentSubmission.content,
        other.content,
        4
      );

      matches.push({
        submissionId: other._id as mongoose.Types.ObjectId,
        studentId: other.student as mongoose.Types.ObjectId,
        score,
        matchedPassages: passages,
      });

      if (score > highestScore) {
        highestScore = score;
      }

      // Also symmetrically update the other submission if its score increased
      if (
        !other.similarityReport ||
        score > (other.similarityReport.highestScore || 0)
      ) {
        const otherMatches = other.similarityReport?.matches || [];
        const existingIdx = otherMatches.findIndex(
          (m) => m.submissionId.toString() === currentSubmission._id.toString()
        );

        const symmetricMatch: ISimilarityMatch = {
          submissionId: currentSubmission._id as mongoose.Types.ObjectId,
          studentId: currentSubmission.student as mongoose.Types.ObjectId,
          score,
          matchedPassages: passages,
        };

        if (existingIdx >= 0) {
          otherMatches[existingIdx] = symmetricMatch;
        } else {
          otherMatches.push(symmetricMatch);
        }

        const otherHighest = Math.max(
          score,
          other.similarityReport?.highestScore || 0
        );

        await Submission.findByIdAndUpdate(other._id, {
          $set: {
            "similarityReport.highestScore": otherHighest,
            "similarityReport.flaggedForReview": otherHighest >= threshold,
            "similarityReport.matches": otherMatches,
            "similarityReport.computedAt": new Date(),
          },
        });
      }
    }
  }

  // Sort matches descending by score
  matches.sort((a, b) => b.score - a.score);

  const report: ISimilarityReport = {
    highestScore,
    flaggedForReview: highestScore >= threshold,
    matches,
    computedAt: new Date(),
  };

  currentSubmission.similarityReport = report;
  await currentSubmission.save();

  return report;
}

