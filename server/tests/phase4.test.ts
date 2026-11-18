import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_phase4_123456";

const TEST_PORT = 5058;
const MONGO_PORT = 27021;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db_phase4");
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let mongodProcess: ChildProcess | null = null;
let serverInstance: http.Server | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startMongo(): Promise<void> {
  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH, { recursive: true, force: true });
  }
  fs.mkdirSync(DB_PATH, { recursive: true });

  const mongodPath = "C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe";

  await new Promise<void>((resolve, reject) => {
    mongodProcess = spawn(mongodPath, [
      "--dbpath",
      DB_PATH,
      "--port",
      String(MONGO_PORT),
      "--bind_ip",
      "127.0.0.1",
    ]);

    let resolved = false;

    mongodProcess.stdout?.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    });

    mongodProcess.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout waiting for mongod to start"));
      }
    }, 10000);
  });
}

async function stopMongo(): Promise<void> {
  if (mongodProcess) {
    mongodProcess.kill();
    await sleep(1000);
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.rmSync(DB_PATH, { recursive: true, force: true });
    } catch {}
  }
}

interface RequestOptions {
  method?: string;
  body?: any;
  cookie?: string;
  token?: string;
}

async function request(endpoint: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  if (options.cookie) {
    headers["Cookie"] = options.cookie;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : undefined;

  return {
    status: res.status,
    data,
    headers: res.headers,
    cookie,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passed++;
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log("=== STARTING PHASE 4 TESTS: Assignments, Plagiarism, AI Evaluation & Peer Code Review ===");

  await startMongo();
  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_phase4`);

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // 1. SETUP USERS
    console.log("\n--- Setting up Users (Instructor, Student1, Student2, Student3) ---");
    const instReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Dr. Alan Turing",
        email: "turing@skillforge.test",
        password: "Password123!",
      },
    });
    const instructorCookie = instReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "turing@skillforge.test" },
      { $set: { role: "instructor" } }
    );
    assert(instReg.status === 201, "Instructor registered");

    const s1Reg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Ada Lovelace",
        email: "ada@skillforge.test",
        password: "Password123!",
      },
    });
    const student1Cookie = s1Reg.cookie;
    const student1Id = s1Reg.data.data.user.id;
    assert(s1Reg.status === 201, "Student 1 (Ada) registered");

    const s2Reg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Charles Babbage",
        email: "charles@skillforge.test",
        password: "Password123!",
      },
    });
    const student2Cookie = s2Reg.cookie;
    const student2Id = s2Reg.data.data.user.id;
    assert(s2Reg.status === 201, "Student 2 (Charles) registered");

    const s3Reg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Grace Hopper",
        email: "grace@skillforge.test",
        password: "Password123!",
      },
    });
    const student3Cookie = s3Reg.cookie;
    const student3Id = s3Reg.data.data.user.id;
    assert(s3Reg.status === 201, "Student 3 (Grace) registered");

    // 2. SETUP COURSE & ENROLLMENTS
    console.log("\n--- Setting up Course & Enrollments ---");
    const courseRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Advanced Algorithms & System Architecture",
        description: "Master algorithms, computational complexity, and clean code paradigms.",
        shortDescription: "Advanced algorithms and systems",
        price: 0,
        category: "Computer Science",
        level: "advanced",
        language: "en",
      },
    });
    const courseId = courseRes.data.data.course._id;
    assert(courseRes.status === 201, "Course created by instructor");

    await request(`/api/courses/${courseId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Enroll Ada, Charles, and Grace
    const en1 = await request(`/api/enrollments/${courseId}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(en1.status === 201, "Student 1 enrolled in course");

    const en2 = await request(`/api/enrollments/${courseId}`, {
      method: "POST",
      cookie: student2Cookie,
    });
    assert(en2.status === 201, "Student 2 enrolled in course");

    const en3 = await request(`/api/enrollments/${courseId}`, {
      method: "POST",
      cookie: student3Cookie,
    });
    assert(en3.status === 201, "Student 3 enrolled in course");

    // 3. FEATURE: ASSIGNMENT CREATION & PERMISSIONS
    console.log("\n--- Testing Assignment Creation & Role Authorization ---");
    // Non-instructor cannot create assignment
    const unauthorizedAssign = await request("/api/assignments", {
      method: "POST",
      cookie: student1Cookie,
      body: {
        courseId,
        title: "Unauthorized Essay",
        description: "Should fail with 403",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert(unauthorizedAssign.status === 403, "Student cannot create assignment (403 Forbidden)");

    // Instructor creates Text Assignment with Rubrics
    const textAssignRes = await request("/api/assignments", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        courseId,
        title: "Essay: Distributed Consensus Mechanisms",
        description: "Analyze Paxos, Raft, and PBFT consensus algorithms with trade-offs.",
        assignmentType: "text",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxScore: 100,
        similarityThreshold: 35,
        rubrics: [
          { criterion: "Consensus Correctness", maxPoints: 50, description: "Depth of Paxos vs Raft" },
          { criterion: "Trade-off Analysis", maxPoints: 30, description: "Latency, throughput, fault tolerance" },
          { criterion: "Academic Rigor", maxPoints: 20, description: "Clarity and structure" },
        ],
        aiEvaluationEnabled: true,
      },
    });
    assert(textAssignRes.status === 201, "Instructor created text assignment with custom rubrics");
    const textAssignmentId = textAssignRes.data.data._id;

    // Instructor creates Code Assignment with Peer Review Enabled
    const codeAssignRes = await request("/api/assignments", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        courseId,
        title: "Implementation: Concurrent LRU Cache",
        description: "Implement a thread-safe LRU cache with O(1) get and put operations.",
        assignmentType: "code",
        allowedLanguages: ["typescript", "javascript", "python"],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxScore: 100,
        similarityThreshold: 40,
        isPeerReviewEnabled: true,
        peerReviewsPerSubmission: 2,
        peerReviewDeadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        rubrics: [
          { criterion: "Algorithmic Complexity", maxPoints: 40, description: "O(1) get and set" },
          { criterion: "Concurrency & Thread Safety", maxPoints: 30, description: "Locking or atomic mechanisms" },
          { criterion: "Clean Code", maxPoints: 30, description: "Formatting and tests" },
        ],
        aiEvaluationEnabled: true,
      },
    });
    assert(codeAssignRes.status === 201, "Instructor created code assignment with peer review enabled");
    const codeAssignmentId = codeAssignRes.data.data._id;

    // View assignments for course
    const listRes = await request(`/api/assignments/course/${courseId}`, {
      method: "GET",
      cookie: student1Cookie,
    });
    assert(listRes.status === 200 && listRes.data.data.length === 2, "Enrolled student can view assignments");

    // 4. FEATURE 6 & 7: SUBMISSION, PLAGIARISM DETECTION & AI EVALUATION
    console.log("\n--- Testing Submissions, Plagiarism Detection & AI Evaluation ---");
    
    // Student 1 (Ada) submits original text essay
    const adaEssay = `
      Distributed consensus is a foundational challenge in decentralized computing architectures.
      In Paxos, consensus is reached through two distinct phases: prepare-promise and accept-accepted.
      Leslie Lamport proved that Paxos guarantees safety under asynchronous network conditions with crash recovery.
      Conversely, Raft simplifies consensus by decomposing it into leader election, log replication, and safety.
      Raft establishes a strong leader paradigm, which makes understanding and state machine auditing considerably more intuitive.
      In comparison, PBFT (Practical Byzantine Fault Tolerance) handles malicious nodes (arbitrary failures) but incurs O(N^2) message overhead.
    `;

    const s1SubRes = await request(`/api/assignments/${textAssignmentId}/submit`, {
      method: "POST",
      cookie: student1Cookie,
      body: { content: adaEssay },
    });
    assert(s1SubRes.status === 200, "Student 1 submitted essay");
    assert(s1SubRes.data.data.similarityReport.highestScore === 0, "Initial submission has 0% similarity");
    assert(s1SubRes.data.data.similarityReport.flaggedForReview === false, "Submission is NOT flagged for review");
    assert(s1SubRes.data.data.aiEvaluation !== undefined, "AI evaluation was automatically triggered");
    assert(s1SubRes.data.data.aiEvaluation.suggestedScore > 60, "AI evaluated submission and suggested score");
    assert(s1SubRes.data.data.aiEvaluation.rubricScores.length === 3, "AI evaluation evaluated against all 3 rubrics");

    // Student 2 (Charles) submits a copied/plagiarized version of Ada's essay
    const charlesEssay = `
      Distributed consensus is a foundational challenge in decentralized computing architectures.
      In Paxos, consensus is reached through two distinct phases: prepare-promise and accept-accepted.
      Leslie Lamport proved that Paxos guarantees safety under asynchronous network conditions with crash recovery.
      Conversely, Raft simplifies consensus by decomposing it into leader election, log replication, and safety.
      Raft establishes a strong leader paradigm, which makes understanding and state machine auditing considerably more intuitive.
      Minor conclusion paragraph added by Charles.
    `;

    const s2SubRes = await request(`/api/assignments/${textAssignmentId}/submit`, {
      method: "POST",
      cookie: student2Cookie,
      body: { content: charlesEssay },
    });
    assert(s2SubRes.status === 200, "Student 2 submitted essay");
    assert(
      s2SubRes.data.data.similarityReport.highestScore > 35,
      `Plagiarism detected high similarity: ${s2SubRes.data.data.similarityReport.highestScore}%`
    );
    assert(
      s2SubRes.data.data.similarityReport.flaggedForReview === true,
      "Submission flagged for instructor review due to exceeding 35% threshold"
    );
    assert(
      s2SubRes.data.data.status !== "failed" && s2SubRes.data.data.status === "submitted",
      "Rule enforced: Did NOT automatically declare plagiarism or penalize; flagged for instructor review"
    );

    // Verify Symmetrical Update: Student 1's report also reflects the match
    const s1Updated = await request(`/api/assignments/${textAssignmentId}`, {
      method: "GET",
      cookie: student1Cookie,
    });
    assert(
      s1Updated.data.data.mySubmission.similarityReport.highestScore > 35,
      "Symmetrical update: Original submission also shows the similarity match"
    );

    // Instructor views flagged submissions
    const flaggedRes = await request(`/api/assignments/${textAssignmentId}/submissions?flagged=true`, {
      method: "GET",
      cookie: instructorCookie,
    });
    assert(flaggedRes.status === 200 && flaggedRes.data.count >= 1, "Instructor can query flagged submissions for review");

    // 5. FEATURE 7: INSTRUCTOR GRADING & AI OVERRIDE WORKFLOW
    console.log("\n--- Testing Instructor AI Grade Approval & Override ---");
    const s1SubmissionId = s1SubRes.data.data._id;
    const s2SubmissionId = s2SubRes.data.data._id;

    // Instructor approves AI grade for Student 1
    const approveAiRes = await request(`/api/assignments/submissions/${s1SubmissionId}/grade`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        useAiScore: true,
        feedback: "Approved AI evaluation. Outstanding academic analysis of consensus mechanisms.",
      },
    });
    assert(approveAiRes.status === 200, "Instructor approved AI evaluation");
    assert(approveAiRes.data.data.status === "graded", "Submission marked as graded");
    assert(approveAiRes.data.data.aiEvaluation.status === "approved", "AI evaluation status changed to approved");
    assert(
      approveAiRes.data.data.grade.score === approveAiRes.data.data.aiEvaluation.suggestedScore,
      "Grade score equals AI suggested score"
    );

    // Instructor manually overrides/grades Student 2 (flagged submission)
    const overrideRes = await request(`/api/assignments/submissions/${s2SubmissionId}/grade`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        score: 30,
        feedback: "Flagged similarity confirmed with Ada's submission. Please submit original work.",
        useAiScore: false,
      },
    });
    assert(overrideRes.status === 200, "Instructor manually graded flagged submission");
    assert(overrideRes.data.data.grade.score === 30, "Instructor score override applied");
    assert(overrideRes.data.data.aiEvaluation.status === "overridden", "AI status marked as overridden");

    // 6. FEATURE 8: PEER-TO-PEER CODE REVIEW
    console.log("\n--- Testing Peer-to-Peer Code Review ---");

    // Language constraint enforcement on code assignment
    const invalidLangRes = await request(`/api/assignments/${codeAssignmentId}/submit`, {
      method: "POST",
      cookie: student1Cookie,
      body: {
        content: "class Cache { /* ruby code */ }",
        language: "ruby", // not in allowedLanguages
      },
    });
    assert(invalidLangRes.status === 400, "Rejected submission with disallowed language (ruby)");

    // Student 1 (Ada) submits TypeScript code
    const adaCode = `
      export class LRUCache<K, V> {
        private capacity: number;
        private map = new Map<K, V>();

        constructor(capacity: number) {
          this.capacity = capacity;
        }

        get(key: K): V | undefined {
          if (!this.map.has(key)) return undefined;
          const val = this.map.get(key)!;
          this.map.delete(key);
          this.map.set(key, val);
          return val;
        }

        put(key: K, value: V): void {
          if (this.map.has(key)) this.map.delete(key);
          this.map.set(key, value);
          if (this.map.size > this.capacity) {
            const firstKey = this.map.keys().next().value;
            if (firstKey !== undefined) this.map.delete(firstKey);
          }
        }
      }
    `;
    const s1CodeSub = await request(`/api/assignments/${codeAssignmentId}/submit`, {
      method: "POST",
      cookie: student1Cookie,
      body: { content: adaCode, language: "typescript" },
    });
    assert(s1CodeSub.status === 200, "Student 1 submitted code");

    // Student 2 (Charles) submits Python code
    const charlesCode = `
      from collections import OrderedDict

      class LRUCache:
          def __init__(self, capacity: int):
              self.capacity = capacity
              self.cache = OrderedDict()

          def get(self, key: int) -> int:
              if key not in self.cache:
                  return -1
              self.cache.move_to_end(key)
              return self.cache[key]

          def put(self, key: int, value: int) -> None:
              if key in self.cache:
                  self.cache.move_to_end(key)
              self.cache[key] = value
              if len(self.cache) > self.capacity:
                  self.cache.popitem(last=False)
    `;
    const s2CodeSub = await request(`/api/assignments/${codeAssignmentId}/submit`, {
      method: "POST",
      cookie: student2Cookie,
      body: { content: charlesCode, language: "python" },
    });
    assert(s2CodeSub.status === 200, "Student 2 submitted code");

    // Student 3 (Grace) submits JavaScript code
    const graceCode = `
      class DoublyLinkedListNode {
        constructor(key, val) {
          this.key = key;
          this.val = val;
          this.prev = null;
          this.next = null;
        }
      }

      class LRUCache {
        constructor(capacity) {
          this.capacity = capacity;
          this.map = new Map();
          this.head = new DoublyLinkedListNode(0, 0);
          this.tail = new DoublyLinkedListNode(0, 0);
          this.head.next = this.tail;
          this.tail.prev = this.head;
        }
      }
    `;
    const s3CodeSub = await request(`/api/assignments/${codeAssignmentId}/submit`, {
      method: "POST",
      cookie: student3Cookie,
      body: { content: graceCode, language: "javascript" },
    });
    assert(s3CodeSub.status === 200, "Student 3 submitted code");

    // Instructor triggers peer review assignment
    const assignPeerRes = await request("/api/peer-reviews/assign", {
      method: "POST",
      cookie: instructorCookie,
      body: { assignmentId: codeAssignmentId },
    });
    assert(assignPeerRes.status === 200, "Instructor triggered peer review assignment");
    assert(assignPeerRes.data.count > 0, `Generated ${assignPeerRes.data.count} peer review assignments`);

    // Verify: Students cannot review their own submissions
    const assignedToAda = await request("/api/peer-reviews/assigned", {
      method: "GET",
      cookie: student1Cookie,
    });
    assert(assignedToAda.status === 200, "Ada retrieved assigned peer reviews");
    const selfReview = assignedToAda.data.data.find((r: any) => r.author._id === student1Id);
    assert(!selfReview, "Strict rule verified: Student is NEVER assigned to review their own submission");

    // Ada adds inline code comments to Charles's submission
    const reviewForCharles = assignedToAda.data.data[0];
    const reviewId = reviewForCharles._id;

    const commentRes = await request(`/api/peer-reviews/${reviewId}/comments`, {
      method: "POST",
      cookie: student1Cookie,
      body: {
        line: 9,
        comment: "Excellent use of OrderedDict.move_to_end() to achieve O(1) recency update.",
      },
    });
    assert(commentRes.status === 200, "Reviewer added inline code comment");
    assert(commentRes.data.data.status === "in_progress", "Review status updated to in_progress");

    // Prevent non-assigned student from adding comments (Unauthorized check)
    const hackComment = await request(`/api/peer-reviews/${reviewId}/comments`, {
      method: "POST",
      cookie: student2Cookie, // Charles trying to comment on his own review assigned to Ada
      body: { line: 5, comment: "Should fail" },
    });
    assert(hackComment.status === 403, "Non-assigned student cannot comment on review (403 Forbidden)");

    // Ada submits completed peer review
    const submitReviewRes = await request(`/api/peer-reviews/${reviewId}/review`, {
      method: "POST",
      cookie: student1Cookie,
      body: {
        score: 95,
        feedback: "Clean and idiomatic Python implementation. Time complexity is optimal O(1).",
        codeComments: [
          { line: 17, comment: "popitem(last=False) correctly evicts least recently used item." },
        ],
      },
    });
    assert(submitReviewRes.status === 200, "Ada submitted completed peer review");
    assert(submitReviewRes.data.data.status === "completed", "Review status marked as completed");
    assert(submitReviewRes.data.data.codeComments.length >= 2, "Code comments recorded properly");

    // Charles views peer reviews received for his submission
    const charlesReceivedRes = await request(`/api/peer-reviews/received/${s2CodeSub.data.data._id}`, {
      method: "GET",
      cookie: student2Cookie,
    });
    assert(charlesReceivedRes.status === 200, "Student retrieved peer reviews received");
    assert(charlesReceivedRes.data.data.length >= 1, "Received completed review from Ada");
    assert(charlesReceivedRes.data.data[0].score === 95, "Peer review score is visible to author");

    // Instructor views all peer reviews & completion rate for the assignment
    const instPeerOverview = await request(`/api/peer-reviews/assignment/${codeAssignmentId}`, {
      method: "GET",
      cookie: instructorCookie,
    });
    assert(instPeerOverview.status === 200, "Instructor viewed peer reviews overview");
    assert(instPeerOverview.data.data.total > 0, "Total reviews counted");
    assert(instPeerOverview.data.data.completed >= 1, "Completed reviews counted");

    console.log(`\n========================================`);
    console.log(`Phase 4 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    await stopMongo();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
