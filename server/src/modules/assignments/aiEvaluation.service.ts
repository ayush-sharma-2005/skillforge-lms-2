import { Submission, type IAiEvaluation, type IRubricScore } from "./submission.model";
import { Assignment, type IRubricItem } from "./assignment.model";

export interface AiEvaluationResult {
  suggestedScore: number;
  feedback: string;
  rubricScores: IRubricScore[];
  modelUsed: string;
}

/**
 * Heuristic/Rule-based evaluator used as fallback or when no external API key is provided.
 * Provides realistic, rubric-aligned scores and constructive feedback.
 */
function heuristicEvaluate(
  content: string,
  assignmentType: "text" | "code",
  maxScore: number,
  rubrics: IRubricItem[]
): AiEvaluationResult {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = content.trim().split(/\n/).length;

  // If no custom rubrics defined, generate default breakdown
  const effectiveRubrics: IRubricItem[] =
    rubrics && rubrics.length > 0
      ? rubrics
      : [
          {
            criterion: "Correctness & Completeness",
            maxPoints: Math.round(maxScore * 0.5),
            description: "Directly fulfills the requirements",
          },
          {
            criterion: "Structure & Clarity",
            maxPoints: Math.round(maxScore * 0.3),
            description: "Logical flow, readability, and organization",
          },
          {
            criterion: assignmentType === "code" ? "Code Quality & Best Practices" : "Depth & Critical Thinking",
            maxPoints: Math.round(maxScore * 0.2),
            description: "Adherence to conventions and quality standards",
          },
        ];

  const rubricScores: IRubricScore[] = [];
  let totalScore = 0;

  for (const rubric of effectiveRubrics) {
    let ratio = 0.8; // Baseline good submission

    // Content depth bonus
    if (assignmentType === "code") {
      const hasFunctions = /function|def |class |const |let |var |=>/i.test(content);
      const hasComments = /\/\/|\/\*|#|"""/i.test(content);
      if (hasFunctions) ratio += 0.1;
      if (hasComments) ratio += 0.05;
      if (lineCount < 5) ratio -= 0.3;
    } else {
      if (wordCount >= 100) ratio += 0.1;
      if (wordCount >= 200) ratio += 0.05;
      if (wordCount < 30) ratio -= 0.3;
    }

    ratio = Math.max(0.2, Math.min(1.0, ratio));
    const score = Math.round(rubric.maxPoints * ratio);
    totalScore += score;

    rubricScores.push({
      criterion: rubric.criterion,
      score,
      feedback:
        score >= rubric.maxPoints * 0.85
          ? `Strong demonstration of ${rubric.criterion.toLowerCase()}. Requirements are well addressed.`
          : `Adequate fulfillment for ${rubric.criterion.toLowerCase()}. Consider expanding detail and providing more thorough examples.`,
    });
  }

  // Cap total score at maxScore
  const suggestedScore = Math.min(maxScore, totalScore);

  const feedback =
    suggestedScore >= maxScore * 0.8
      ? `Great work on this ${assignmentType} assignment! Your submission is well-structured and clearly addresses the core objectives.`
      : `Good effort. The submission covers key concepts, but could benefit from deeper analysis and refined organization.`;

  return {
    suggestedScore,
    feedback,
    rubricScores,
    modelUsed: "heuristic-rubric-evaluator-v1",
  };
}

/**
 * Evaluates a submission using Gemini API if available, falling back to heuristic evaluation.
 */
export async function evaluateSubmissionWithAi(
  submissionId: string
): Promise<IAiEvaluation> {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  const assignment = await Assignment.findById(submission.assignment);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const provider = process.env.AI_EVALUATION_PROVIDER || (apiKey ? "gemini" : "heuristic");

  let evaluationResult: AiEvaluationResult;

  if (provider === "gemini" && apiKey) {
    try {
      const prompt = `You are an expert academic evaluator. Evaluate the following student assignment submission strictly according to the rubrics.

Assignment Title: "${assignment.title}"
Assignment Description: "${assignment.description}"
Assignment Type: ${assignment.assignmentType}
Max Score: ${assignment.maxScore}

Rubrics:
${JSON.stringify(assignment.rubrics, null, 2)}

Student Submission:
"""
${submission.content}
"""

Return STRICTLY a JSON object with this exact shape:
{
  "suggestedScore": number,
  "feedback": "constructive, encouraging feedback string",
  "rubricScores": [
    {
      "criterion": "criterion name",
      "score": number,
      "feedback": "criterion specific note"
    }
  ]
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const textContent =
          data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const parsed = JSON.parse(textContent);
          evaluationResult = {
            suggestedScore: Number(parsed.suggestedScore) || assignment.maxScore * 0.75,
            feedback: parsed.feedback || "Evaluated by AI",
            rubricScores: Array.isArray(parsed.rubricScores) ? parsed.rubricScores : [],
            modelUsed: "gemini-1.5-flash",
          };
        } else {
          evaluationResult = heuristicEvaluate(
            submission.content,
            assignment.assignmentType,
            assignment.maxScore,
            assignment.rubrics
          );
        }
      } else {
        // Fallback on non-200
        evaluationResult = heuristicEvaluate(
          submission.content,
          assignment.assignmentType,
          assignment.maxScore,
          assignment.rubrics
        );
      }
    } catch {
      // Fallback on network or parsing error
      evaluationResult = heuristicEvaluate(
        submission.content,
        assignment.assignmentType,
        assignment.maxScore,
        assignment.rubrics
      );
    }
  } else {
    // Deterministic heuristic evaluator
    evaluationResult = heuristicEvaluate(
      submission.content,
      assignment.assignmentType,
      assignment.maxScore,
      assignment.rubrics
    );
  }

  const aiEvaluation: IAiEvaluation = {
    suggestedScore: evaluationResult.suggestedScore,
    feedback: evaluationResult.feedback,
    rubricScores: evaluationResult.rubricScores,
    status: "suggested",
    modelUsed: evaluationResult.modelUsed,
    evaluatedAt: new Date(),
  };

  submission.aiEvaluation = aiEvaluation;
  await submission.save();

  return aiEvaluation;
}

