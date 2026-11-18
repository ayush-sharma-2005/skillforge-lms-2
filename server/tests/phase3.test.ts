import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_phase3_123456";

const TEST_PORT = 5057;
const MONGO_PORT = 27020;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db_phase3");
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

  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_test_phase3`);
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
  console.log("   SKILLFORGE LMS — PHASE 3 INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  await startMongo();

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // ---------------------------------------------------------
    // Setup Users
    // ---------------------------------------------------------
    console.log("[Setup] Creating Accounts & Course");
    const instReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Instructor Marcus", email: "marcus@skillforge.test", password: "Password123!" },
    });
    const instructorCookie = instReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "marcus@skillforge.test" },
      { $set: { role: "instructor" } }
    );

    const bobReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Student Bob", email: "bob3@skillforge.test", password: "Password123!" },
    });
    const bobCookie = bobReg.cookie;

    const charlieReg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Student Charlie", email: "charlie3@skillforge.test", password: "Password123!" },
    });
    const charlieCookie = charlieReg.cookie;

    // Create Course
    const courseRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Full-Stack Cloud Architecture v1",
        description: "Comprehensive guide to microservices and cloud deployment architectures.",
        shortDescription: "Cloud architecture guide.",
        price: 0,
        category: "Cloud Computing",
        level: "advanced",
        thumbnail: "https://cdn.skillforge.test/thumbs/cloud.png",
      },
    });
    const courseId = courseRes.data.data.course._id;
    await request(`/api/courses/${courseId}/publish`, { method: "PATCH", cookie: instructorCookie });

    // Bob enrolls in the course (Charlie is not enrolled)
    await request(`/api/enrollments/${courseId}`, { method: "POST", cookie: bobCookie });

    // ---------------------------------------------------------
    // 1. Learning Accessibility & WCAG Auditing
    // ---------------------------------------------------------
    console.log("\n[Test Group 1] Learning Accessibility & WCAG Auditing");

    // Create Lesson with Captions, Transcript & Audio Description
    const lesson1Res = await request(`/api/lessons/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson 1: Cloud Infrastructure Overview",
        description: "Introduction to regions, availability zones, and VPC networking.",
        videoUrl: "https://videos.skillforge.test/cloud-overview.mp4",
        duration: 720,
        order: 1,
        transcript: "Full audio transcript of Cloud Infrastructure Overview...",
        audioDescriptionUrl: "https://videos.skillforge.test/audio-desc-lesson1.mp3",
        captions: [
          { language: "en", label: "English CC", url: "https://cdn.skillforge.test/captions/l1-en.vtt", isDefault: true },
          { language: "es", label: "Spanish CC", url: "https://cdn.skillforge.test/captions/l1-es.vtt", isDefault: false },
        ],
        accessibility: {
          estimatedReadingTimeMinutes: 12,
          screenReaderNotes: "Lesson 1 covers VPC network diagrams with descriptive text equivalents.",
          hasHighContrastSupport: true,
        },
      },
    });
    assert(lesson1Res.status === 201, "Instructor creates accessible lesson with captions & transcript");
    const lesson1Id = lesson1Res.data.data.lesson._id;
    await request(`/api/lessons/${lesson1Id}/publish`, { method: "PATCH", cookie: instructorCookie });

    // Fetch accessible lesson context
    const accessContext = await request(`/api/lessons/${lesson1Id}/accessible-context`, {
      cookie: bobCookie,
    });
    assert(
      accessContext.status === 200 &&
        accessContext.data.data.captions.length === 2 &&
        Boolean(accessContext.data.data.transcript) &&
        Boolean(accessContext.data.data.navigation.keyboardShortcuts),
      "Accessible lesson context returns captions, transcript, and keyboard navigation schema"
    );

    // Course Accessibility Audit
    const auditRes = await request(`/api/lessons/courses/${courseId}/accessibility-audit`);
    assert(
      auditRes.status === 200 &&
        auditRes.data.data.metrics.captionsCoveragePercentage === 100 &&
        auditRes.data.data.metrics.transcriptCoveragePercentage === 100 &&
        auditRes.data.data.compliance.wcagLevel === "WCAG 2.1 AA Compliant",
      "Course accessibility audit confirms 100% captions & transcripts coverage with WCAG 2.1 AA status"
    );

    // ---------------------------------------------------------
    // 2. Offline Learning & Download Support
    // ---------------------------------------------------------
    console.log("\n[Test Group 2] Offline Learning & Secure Download Support");

    // Create downloadable PDF resource
    const pdfRes = await request("/api/resources", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        courseId,
        lessonId: lesson1Id,
        title: "Cloud Infrastructure Cheat Sheet",
        description: "Offline reference guide for cloud networks and CIDR blocks.",
        fileUrl: "https://cdn.skillforge.test/downloads/cloud-cheatsheet.pdf",
        fileSize: 204800,
        fileType: "pdf",
        isDownloadable: true,
      },
    });
    assert(pdfRes.status === 201, "Instructor uploads downloadable course resource");
    const pdfResourceId = pdfRes.data.data.resource._id;

    // Create non-downloadable streaming resource
    const streamRes = await request("/api/resources", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        courseId,
        title: "Proprietary Lab Setup Guide",
        description: "View-only in-browser lab guide.",
        fileUrl: "https://cdn.skillforge.test/docs/lab-setup.pdf",
        fileSize: 512000,
        fileType: "pdf",
        isDownloadable: false,
      },
    });
    const streamResourceId = streamRes.data.data.resource._id;

    // Unenrolled Charlie tries to view resources -> 403 Forbidden
    const unenrolledResources = await request(`/api/resources/course/${courseId}`, {
      cookie: charlieCookie,
    });
    assert(
      unenrolledResources.status === 403,
      "Unenrolled student blocked from viewing course resources (403 Forbidden)"
    );

    // Enrolled Bob views resources -> Sees only downloadable resources
    const bobResources = await request(`/api/resources/course/${courseId}`, {
      cookie: bobCookie,
    });
    assert(
      bobResources.status === 200 &&
        bobResources.data.data.resources.some((r: any) => r._id === pdfResourceId) &&
        !bobResources.data.data.resources.some((r: any) => r._id === streamResourceId),
      "Enrolled student views downloadable resources (non-downloadable excluded)"
    );

    // Bob requests signed download token for permitted resource
    const tokenRes = await request(`/api/resources/${pdfResourceId}/download-token`, {
      method: "POST",
      cookie: bobCookie,
    });
    assert(
      tokenRes.status === 200 &&
        Boolean(tokenRes.data.data.downloadToken) &&
        tokenRes.data.data.expiresInSeconds === 900,
      "Signed 15-minute download token successfully generated for enrolled student"
    );
    const validToken = tokenRes.data.data.downloadToken;

    // Bob tries to generate download token for non-downloadable resource -> 403 Forbidden
    const blockedTokenRes = await request(`/api/resources/${streamResourceId}/download-token`, {
      method: "POST",
      cookie: bobCookie,
    });
    assert(
      blockedTokenRes.status === 403,
      "Download token generation rejected for non-downloadable resource (403 Forbidden)"
    );

    // Download resource with valid token
    const downloadRes = await request(`/api/resources/download/${validToken}`);
    assert(
      downloadRes.status === 200 &&
        downloadRes.data.data.fileUrl === "https://cdn.skillforge.test/downloads/cloud-cheatsheet.pdf" &&
        downloadRes.data.data.downloadCount === 1,
      "Download authorized with valid signed token; download log and count incremented"
    );

    // Download resource with invalid/tampered token -> 401 Unauthorized
    const invalidTokenRes = await request("/api/resources/download/tampered.jwt.token");
    assert(
      invalidTokenRes.status === 401,
      "Download rejected with invalid or tampered token (401 Unauthorized)"
    );

    // Instructor views resource analytics
    const resAnalytics = await request(`/api/resources/course/${courseId}/analytics`, {
      cookie: instructorCookie,
    });
    assert(
      resAnalytics.status === 200 &&
        resAnalytics.data.data.totalDownloads === 1 &&
        resAnalytics.data.data.recentDownloads.length === 1,
      "Instructor views download analytics, download counts, and student audit trail"
    );

    // ---------------------------------------------------------
    // 3. Course Version Management
    // ---------------------------------------------------------
    console.log("\n[Test Group 3] Course Version Management & Version Diffs");

    // Instructor snapshots Version 1.0
    const v1Res = await request(`/api/course-versions/course/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        version: "1.0",
        changelog: "Initial release of Full-Stack Cloud Architecture course.",
      },
    });
    assert(v1Res.status === 201, "Instructor snapshots Course Version 1.0");
    const v1Id = v1Res.data.data.courseVersion._id;

    // Duplicate version 1.0 creation rejected
    const dupV1 = await request(`/api/course-versions/course/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        version: "1.0",
        changelog: "Duplicate version attempt.",
      },
    });
    assert(dupV1.status === 409, "Duplicate course version number rejected (409 Conflict)");

    // Modify course and add Lesson 2 to prepare for Version 2.0
    await request(`/api/courses/${courseId}`, {
      method: "PATCH",
      cookie: instructorCookie,
      body: {
        title: "Full-Stack Cloud Architecture v2 (Updated Edition)",
      },
    });

    const lesson2Res = await request(`/api/lessons/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson 2: Kubernetes Container Orchestration",
        description: "Deploying production pods, services, and ingresses.",
        videoUrl: "https://videos.skillforge.test/k8s.mp4",
        duration: 1200,
        order: 2,
      },
    });
    const lesson2Id = lesson2Res.data.data.lesson._id;
    await request(`/api/lessons/${lesson2Id}/publish`, { method: "PATCH", cookie: instructorCookie });

    // Instructor snapshots Version 2.0
    const v2Res = await request(`/api/course-versions/course/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        version: "2.0",
        changelog: "Major update: added Lesson 2 on Kubernetes and updated curriculum title.",
      },
    });
    assert(
      v2Res.status === 201 && v2Res.data.data.courseVersion.isCurrent === true,
      "Instructor snapshots Course Version 2.0 (marked as current version)"
    );
    const v2Id = v2Res.data.data.courseVersion._id;

    // Compare Version 1.0 and Version 2.0 (Diff Engine)
    const diffRes = await request(`/api/course-versions/compare/${v1Id}/${v2Id}`, {
      cookie: instructorCookie,
    });
    const diffData = diffRes.data.data.diff;
    assert(
      diffRes.status === 200 &&
        diffData.addedLessonsCount === 1 &&
        diffData.addedLessons[0].title === "Lesson 2: Kubernetes Container Orchestration" &&
        Boolean(diffData.metadataChanges.title),
      "Version comparison diff accurately identifies added Lesson 2 and metadata title update"
    );

    // Enrolled student Bob lists all versions
    const versionsList = await request(`/api/course-versions/course/${courseId}`, {
      cookie: bobCookie,
    });
    assert(
      versionsList.status === 200 && versionsList.data.data.versions.length === 2,
      "Enrolled student can view complete course version history"
    );

    // Enrolled student views Version 1.0 snapshot detail
    const v1Detail = await request(`/api/course-versions/${v1Id}`, {
      cookie: bobCookie,
    });
    assert(
      v1Detail.status === 200 &&
        v1Detail.data.data.courseVersion.snapshot.lessons.length === 1 &&
        v1Detail.data.data.courseVersion.snapshot.title === "Full-Stack Cloud Architecture v1",
      "Student can access historical Version 1.0 curriculum snapshot preserved from initial enrollment"
    );

    // Unenrolled Charlie blocked from viewing course versions
    const unenrolledVersions = await request(`/api/course-versions/course/${courseId}`, {
      cookie: charlieCookie,
    });
    assert(
      unenrolledVersions.status === 403,
      "Unenrolled student blocked from course version history (403 Forbidden)"
    );
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

