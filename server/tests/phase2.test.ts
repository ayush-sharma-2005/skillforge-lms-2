import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_phase2_123456";

const TEST_PORT = 5056;
const MONGO_PORT = 27019;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db_phase2");
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

  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_test_phase2`);
}

async function stopMongo(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } catch (err) {
    console.error("Error dropping database:", err);
  }

  if (mongodProcess && mongodProcess.pid) {
    mongodProcess.kill();
    await sleep(500);
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      fs.rmSync(DB_PATH, { recursive: true, force: true });
    } catch {}
  }
}

interface TestResponse {
  status: number;
  data: any;
  headers: Headers;
  cookie?: string;
}

async function request(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
    cookie?: string;
  } = {}
): Promise<TestResponse> {
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

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failedTests++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   SKILLFORGE LMS — PHASE 2 INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  await startMongo();

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // ---------------------------------------------------------
    // Setup Users
    // ---------------------------------------------------------
    console.log("[Setup] Creating Accounts");
    const instReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Instructor Elena", email: "elena@skillforge.test", password: "Password123!" },
    });
    const instructorCookie = instReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "elena@skillforge.test" },
      { $set: { role: "instructor" } }
    );

    const bobReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Student Bob", email: "bob@skillforge.test", password: "Password123!" },
    });
    const bobCookie = bobReg.cookie;

    const charlieReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Student Charlie", email: "charlie@skillforge.test", password: "Password123!" },
    });
    const charlieCookie = charlieReg.cookie;

    // Create course
    const courseRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Modern Full-Stack Web Architecture",
        description: "Master modern full-stack engineering with TypeScript, Express and React.",
        shortDescription: "Full stack engineering mastery.",
        price: 0,
        category: "Software Development",
        level: "intermediate",
        language: "en",
      },
    });
    const courseId = courseRes.data.data.course._id;
    await request(`/api/courses/${courseId}/publish`, { method: "PATCH", cookie: instructorCookie });

    // Create lesson
    const lessonRes = await request(`/api/lessons/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson 1: System Design Principles",
        description: "Introduction to modular architecture and clean code principles.",
        videoUrl: "https://videos.skillforge.test/sys-design.mp4",
        duration: 900,
        order: 1,
      },
    });
    const lessonId = lessonRes.data.data.lesson._id;
    await request(`/api/lessons/${lessonId}/publish`, { method: "PATCH", cookie: instructorCookie });

    // Bob enrolls in the course (Charlie remains unenrolled)
    await request(`/api/enrollments/${courseId}`, { method: "POST", cookie: bobCookie });

    // ---------------------------------------------------------
    // 1. Multi-language Course Support
    // ---------------------------------------------------------
    console.log("\n[Test Group 1] Multi-Language Course & Lesson Support");

    // Add Spanish translation to course
    const addCourseEs = await request(`/api/courses/${courseId}/translations`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        language: "es",
        title: "Arquitectura Web Full-Stack Moderna",
        description: "Domine la ingeniería full-stack moderna con TypeScript, Express y React.",
        shortDescription: "Dominio de desarrollo web full-stack.",
      },
    });
    assert(addCourseEs.status === 200, "Instructor adds Spanish translation to course");

    // Add French translation to course
    const addCourseFr = await request(`/api/courses/${courseId}/translations`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        language: "fr",
        title: "Architecture Web Moderne Full-Stack",
        description: "Maîtrisez l'ingénierie moderne avec TypeScript, Express et React.",
        shortDescription: "Maîtrise du développement web.",
      },
    });
    assert(addCourseFr.status === 200, "Instructor adds French translation to course");

    // Fetch course in default language (en)
    const getCourseEn = await request(`/api/courses/${courseId}`);
    assert(
      getCourseEn.data.data.course.title === "Modern Full-Stack Web Architecture" &&
        getCourseEn.data.data.course.activeLanguage === "en",
      "Course returns default English content when no language requested"
    );

    // Fetch course in Spanish
    const getCourseEs = await request(`/api/courses/${courseId}?lang=es`);
    assert(
      getCourseEs.data.data.course.title === "Arquitectura Web Full-Stack Moderna" &&
        getCourseEs.data.data.course.activeLanguage === "es" &&
        getCourseEs.data.data.course.isTranslated === true,
      "Course dynamically presents Spanish translated title & description"
    );

    // Fetch course in German (untranslated) -> Fallback to English
    const getCourseDe = await request(`/api/courses/${courseId}?lang=de`);
    assert(
      getCourseDe.data.data.course.title === "Modern Full-Stack Web Architecture" &&
        getCourseDe.data.data.course.activeLanguage === "en" &&
        getCourseDe.data.data.course.isTranslated === false,
      "Course gracefully falls back to default language for missing translations"
    );

    // Add Spanish translation to Lesson
    const addLessonEs = await request(`/api/lessons/${lessonId}/translations`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        language: "es",
        title: "Lección 1: Principios de Diseño de Sistemas",
        description: "Introducción a la arquitectura modular y código limpio.",
        transcript: "Transcripción completa en español...",
      },
    });
    assert(addLessonEs.status === 200, "Instructor adds Spanish translation to lesson");

    // Bob fetches lessons with ?lang=es
    const getLessonsEs = await request(`/api/lessons/course/${courseId}?lang=es`, {
      cookie: bobCookie,
    });
    const esLesson = getLessonsEs.data.data.lessons[0];
    assert(
      esLesson.title === "Lección 1: Principios de Diseño de Sistemas" &&
        esLesson.activeLanguage === "es" &&
        esLesson.transcript === "Transcripción completa en español...",
      "Student receives localized lesson title, description, and transcript in Spanish"
    );

    // ---------------------------------------------------------
    // 2. Course Discussion per Lesson
    // ---------------------------------------------------------
    console.log("\n[Test Group 2] Lesson Discussions, Threading & Moderation");

    // Unenrolled Charlie tries to post question -> 403 Forbidden
    const unenrolledPost = await request(`/api/discussions/lessons/${lessonId}`, {
      method: "POST",
      cookie: charlieCookie,
      body: { content: "Can I participate without enrollment?" },
    });
    assert(
      unenrolledPost.status === 403,
      "Unenrolled student blocked from posting in discussions (403 Forbidden)"
    );

    // Enrolled Bob posts question
    const postQRes = await request(`/api/discussions/lessons/${lessonId}`, {
      method: "POST",
      cookie: bobCookie,
      body: { content: "How do we handle circular dependency issues in microservices?" },
    });
    assert(postQRes.status === 201, "Enrolled student Bob posts a question under the lesson");
    const questionId = postQRes.data.data.discussion._id;

    // Instructor Elena replies to the question
    const instReplyRes = await request(`/api/discussions/${questionId}/reply`, {
      method: "POST",
      cookie: instructorCookie,
      body: { content: "Use event-driven architecture or asynchronous messaging to break cyclic calls." },
    });
    assert(
      instReplyRes.status === 201 && instReplyRes.data.data.reply.isInstructorReply === true,
      "Instructor replies to question with isInstructorReply badge"
    );
    const replyId = instReplyRes.data.data.reply._id;

    // Bob posts follow-up reply
    const bobReplyRes = await request(`/api/discussions/${questionId}/reply`, {
      method: "POST",
      cookie: bobCookie,
      body: { content: "Thank you! That makes complete sense." },
    });
    assert(bobReplyRes.status === 201, "Student posts nested follow-up reply");

    // Fetch lesson discussions
    const discussionsList = await request(`/api/discussions/lessons/${lessonId}`, {
      cookie: bobCookie,
    });
    const discussionItem = discussionsList.data.data.discussions[0];
    assert(
      discussionItem._id === questionId && discussionItem.replies.length === 2,
      "Discussion returned with threaded replies and reply count"
    );

    // Bob edits his question
    const editRes = await request(`/api/discussions/${questionId}`, {
      method: "PATCH",
      cookie: bobCookie,
      body: { content: "How do we handle circular dependency issues in distributed systems?" },
    });
    assert(editRes.status === 200, "Author successfully edits their question");

    // Charlie tries to edit Bob's question -> 403 Forbidden
    const unauthEdit = await request(`/api/discussions/${questionId}`, {
      method: "PATCH",
      cookie: charlieCookie,
      body: { content: "Hacked question content." },
    });
    assert(unauthEdit.status === 403, "Non-author blocked from editing another user's question (403 Forbidden)");

    // Report discussion as inappropriate
    const reportRes = await request(`/api/discussions/${questionId}/report`, {
      method: "POST",
      cookie: bobCookie,
      body: { reason: "Flagged for instructor review." },
    });
    assert(reportRes.status === 200, "User reports discussion for moderation");

    // Duplicate report from same user rejected
    const dupReportRes = await request(`/api/discussions/${questionId}/report`, {
      method: "POST",
      cookie: bobCookie,
      body: { reason: "Duplicate report attempt." },
    });
    assert(dupReportRes.status === 409, "Duplicate report by same user rejected (409 Conflict)");

    // Instructor views flagged discussions queue
    const flaggedQueue = await request(`/api/discussions/courses/${courseId}/flagged`, {
      cookie: instructorCookie,
    });
    assert(
      flaggedQueue.status === 200 && flaggedQueue.data.data.flaggedDiscussions.length > 0,
      "Instructor accesses flagged discussions moderation queue"
    );

    // Instructor moderates discussion (Pins it and sets status active)
    const moderateRes = await request(`/api/discussions/${questionId}/moderate`, {
      method: "PATCH",
      cookie: instructorCookie,
      body: { isPinned: true, status: "active" },
    });
    assert(
      moderateRes.status === 200 && moderateRes.data.data.discussion.isPinned === true,
      "Instructor pins important discussion"
    );

    // ---------------------------------------------------------
    // 3. Learning Time Analytics
    // ---------------------------------------------------------
    console.log("\n[Test Group 3] Learning Time Tracking, Idle Avoidance & Analytics");

    // Unenrolled student tries to send heartbeat -> 403 Forbidden
    const unenrolledHeartbeat = await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: charlieCookie,
      body: { courseId, lessonId, durationSeconds: 60 },
    });
    assert(
      unenrolledHeartbeat.status === 403,
      "Unenrolled student blocked from logging learning time (403 Forbidden)"
    );

    // Heartbeat duration exceeding max cap is rejected by validation (prevents idle inflation)
    const excessiveHeartbeat = await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: bobCookie,
      body: { courseId, lessonId, durationSeconds: 3600 },
    });
    assert(
      excessiveHeartbeat.status === 400,
      "Excessive heartbeat rejected by validation schema (>120s idle protection)"
    );

    // Bob records valid active heartbeat (60 seconds)
    const validHeartbeat1 = await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: bobCookie,
      body: { courseId, lessonId, durationSeconds: 60 },
    });
    assert(
      validHeartbeat1.status === 200 && validHeartbeat1.data.data.addedSeconds === 60,
      "Bob records active 60-second learning heartbeat"
    );

    // Bob records second active heartbeat (60 seconds)
    const validHeartbeat2 = await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: bobCookie,
      body: { courseId, lessonId, durationSeconds: 60 },
    });
    assert(
      validHeartbeat2.status === 200 && validHeartbeat2.data.data.allTimeLessonSeconds >= 120,
      "Learning time accumulates accurately in session record (120s total)"
    );

    // Student fetches personal learning time analytics
    const studentAnalytics = await request("/api/learning-time/student/summary", {
      cookie: bobCookie,
    });
    assert(
      studentAnalytics.status === 200 &&
        studentAnalytics.data.data.summary.totalAllTimeSeconds >= 120 &&
        studentAnalytics.data.data.courseBreakdown.length > 0,
      "Student summary exposes total learning seconds, daily logs, and course breakdown"
    );

    // Instructor fetches course-wide learning analytics
    const courseAnalytics = await request(`/api/learning-time/courses/${courseId}`, {
      cookie: instructorCookie,
    });
    assert(
      courseAnalytics.status === 200 &&
        courseAnalytics.data.data.summary.activeStudentCount === 1 &&
        courseAnalytics.data.data.lessonBreakdown.length > 0,
      "Instructor fetches course analytics with active students and lesson-level breakdown"
    );

    // Non-instructor student blocked from course analytics -> 403 Forbidden
    const unauthCourseAnalytics = await request(`/api/learning-time/courses/${courseId}`, {
      cookie: bobCookie,
    });
    assert(
      unauthCourseAnalytics.status === 403,
      "Student blocked from viewing instructor-level course time analytics (403 Forbidden)"
    );

    // Cleanup discussion
    const deleteReply = await request(`/api/discussions/${replyId}`, {
      method: "DELETE",
      cookie: instructorCookie,
    });
    assert(deleteReply.status === 200, "Instructor deletes discussion reply");
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await stopMongo();
  }

  console.log("\n=======================================================");
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log("=======================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  stopMongo().finally(() => process.exit(1));
});

