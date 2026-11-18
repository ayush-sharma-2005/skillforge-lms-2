import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_phase5_123456";

const TEST_PORT = 5059;
const MONGO_PORT = 27022;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db_phase5");
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
  console.log("=== STARTING PHASE 5 TESTS: Analytics, Certificates & Guardian Access ===");

  await startMongo();
  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_phase5`);

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // -------------------------------------------------------------
    // 1. SETUP USERS & COURSE
    // -------------------------------------------------------------
    console.log("\n--- Setting up Accounts (Instructor, Student, Parent/Guardian) ---");
    const instReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Professor Andrew Ng",
        email: "andrew@skillforge.test",
        password: "Password123!",
      },
    });
    const instructorCookie = instReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "andrew@skillforge.test" },
      { $set: { role: "instructor" } }
    );
    assert(instReg.status === 201, "Instructor registered");

    const studentReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Alice Smith",
        email: "alice@skillforge.test",
        password: "Password123!",
      },
    });
    const studentCookie = studentReg.cookie;
    const studentId = studentReg.data.data.user.id;
    assert(studentReg.status === 201, "Student (Alice) registered");

    const parentReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Robert Smith (Parent)",
        email: "robert.smith@guardian.test",
        password: "Password123!",
      },
    });
    const parentCookie = parentReg.cookie;
    assert(parentReg.status === 201, "Parent/Guardian (Robert) registered");

    // Create course with 2 lessons
    const courseRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Deep Learning Foundations & Neural Networks",
        description: "Comprehensive introduction to artificial neural networks.",
        shortDescription: "Deep learning fundamentals",
        price: 0,
        category: "Artificial Intelligence",
        level: "intermediate",
        language: "en",
      },
    });
    const courseId = courseRes.data.data.course._id;
    assert(courseRes.status === 201, "Course created by instructor");

    await request(`/api/courses/${courseId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Add Lesson 1
    const l1Res = await request(`/api/lessons/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson 1: Perceptrons & Activation Functions",
        description: "Understanding weights, biases, and non-linearities.",
        videoUrl: "https://cdn.skillforge.test/videos/lesson1.mp4",
        duration: 30,
        order: 1,
      },
    });
    const lesson1Id = l1Res.data.data.lesson._id;
    assert(l1Res.status === 201, "Lesson 1 created");
    await request(`/api/lessons/${lesson1Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Add Lesson 2
    const l2Res = await request(`/api/lessons/${courseId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson 2: Backpropagation & Gradient Descent",
        description: "Deriving chain rule for multi-layer perceptrons.",
        videoUrl: "https://cdn.skillforge.test/videos/lesson2.mp4",
        duration: 45,
        order: 2,
      },
    });
    const lesson2Id = l2Res.data.data.lesson._id;
    assert(l2Res.status === 201, "Lesson 2 created");
    await request(`/api/lessons/${lesson2Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Student enrolls in course
    const enrollRes = await request(`/api/enrollments/${courseId}`, {
      method: "POST",
      cookie: studentCookie,
    });
    assert(enrollRes.status === 201, "Student enrolled in course");

    // Student records learning time heartbeat
    const timeRes = await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: studentCookie,
      body: {
        courseId,
        lessonId: lesson1Id,
        durationSeconds: 60,
      },
    });
    assert(timeRes.status === 200, "Student recorded active learning time");

    // Student completes Lesson 1 (50% progress)
    await request(`/api/progress/${courseId}/lessons/${lesson1Id}/complete`, {
      method: "POST",
      cookie: studentCookie,
    });

    // -------------------------------------------------------------
    // 2. FEATURE 9: INSTRUCTOR LIVE ANALYTICS
    // -------------------------------------------------------------
    console.log("\n--- Testing Feature 9: Instructor Live Analytics ---");

    // Student blocked from instructor analytics
    const studentAnalytics = await request("/api/instructors/analytics/overview", {
      method: "GET",
      cookie: studentCookie,
    });
    assert(studentAnalytics.status === 403, "Student blocked from instructor analytics (403 Forbidden)");

    // Instructor Overview Analytics
    const overviewRes = await request("/api/instructors/analytics/overview", {
      method: "GET",
      cookie: instructorCookie,
    });
    assert(overviewRes.status === 200, "Instructor fetched overview analytics");
    assert(overviewRes.data.data.summary.totalCourses === 1, "Analytics shows 1 total course");
    assert(overviewRes.data.data.summary.totalEnrollments === 1, "Analytics shows 1 total enrollment");
    assert(overviewRes.data.data.summary.uniqueStudents === 1, "Analytics shows 1 unique student");
    assert(overviewRes.data.data.summary.totalLearningHours >= 0, "Learning hours calculated");

    // Course-wise Detailed Analytics
    const courseAnalytics = await request(
      `/api/instructors/analytics/courses/${courseId}`,
      {
        method: "GET",
        cookie: instructorCookie,
      }
    );
    assert(courseAnalytics.status === 200, "Instructor fetched detailed course analytics");
    assert(courseAnalytics.data.data.course.totalLessons === 2, "Shows total 2 published lessons");
    assert(courseAnalytics.data.data.funnel.length === 2, "Funnel tracks both lessons");
    assert(
      courseAnalytics.data.data.funnel[0].completions === 1,
      "Funnel shows Lesson 1 completed by 1 student"
    );
    assert(
      courseAnalytics.data.data.funnel[1].completions === 0,
      "Funnel shows Lesson 2 completed by 0 students"
    );
    assert(
      courseAnalytics.data.data.dropOffAnalysis !== null,
      "Drop-off analysis successfully identified attrition from Lesson 1 to Lesson 2"
    );

    // -------------------------------------------------------------
    // 3. FEATURE 12: CERTIFICATE EXPIRY, VERIFICATION & RENEWAL
    // -------------------------------------------------------------
    console.log("\n--- Testing Feature 12: Certificate Expiry & Renewal ---");

    // Incomplete Course Certificate Request (Only 50% completed)
    const incompleteCertRes = await request("/api/certificates/issue", {
      method: "POST",
      cookie: studentCookie,
      body: { courseId, validityMonths: 12 },
    });
    assert(
      incompleteCertRes.status === 403,
      "Certificate rejected when course is incomplete (403 Forbidden)"
    );

    // Student completes Lesson 2 (Now 100% completed)
    await request(`/api/progress/${courseId}/lessons/${lesson2Id}/complete`, {
      method: "POST",
      cookie: studentCookie,
    });

    // Student issues Certificate (Valid for 12 months)
    const issueCertRes = await request("/api/certificates/issue", {
      method: "POST",
      cookie: studentCookie,
      body: { courseId, validityMonths: 12 },
    });
    assert(issueCertRes.status === 201, "Certificate issued successfully upon 100% completion");
    const cert = issueCertRes.data.data;
    const certId = cert._id;
    const verificationId = cert.verificationId;
    assert(Boolean(verificationId), `Generated verification ID: ${verificationId}`);
    assert(cert.status === "active", "Certificate status is active");
    assert(Boolean(cert.expiresAt), "Certificate has generated expiry date");

    // PUBLIC Verification — Active Certificate
    const publicVerifyActive = await request(
      `/api/certificates/verify/${verificationId}`
    );
    assert(publicVerifyActive.status === 200, "Public verification endpoint accessible without auth");
    assert(publicVerifyActive.data.isValid === true, "Public verification confirms certificate is valid");
    assert(publicVerifyActive.data.status === "active", "Public status confirmed as active");

    // Public Verification — Invalid ID
    const publicVerifyInvalid = await request(
      "/api/certificates/verify/NON-EXISTENT-ID-12345"
    );
    assert(publicVerifyInvalid.status === 404, "Invalid verification ID returns 404");
    assert(publicVerifyInvalid.data.isValid === false, "Confirmed invalid certificate has isValid: false");

    // Certificate Expiry Verification Workflow
    // Simulate expired certificate by setting expiresAt in past
    await mongoose.connection.collection("certificates").updateOne(
      { _id: new mongoose.Types.ObjectId(certId) },
      { $set: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    );

    const publicVerifyExpired = await request(
      `/api/certificates/verify/${verificationId}`
    );
    assert(publicVerifyExpired.status === 200, "Expired certificate checked via public verify");
    assert(
      publicVerifyExpired.data.isValid === false,
      "Strict rule enforced: Expired certificate DOES NOT appear valid (isValid: false)"
    );
    assert(
      publicVerifyExpired.data.status === "expired",
      "Status correctly reported as expired"
    );

    // Certificate Renewal Workflow
    const renewRes = await request(`/api/certificates/${certId}/renew`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        additionalMonths: 12,
        notes: "Annual recertification requirements satisfied.",
      },
    });
    assert(renewRes.status === 200, "Certificate renewed by instructor for +12 months");
    assert(renewRes.data.data.status === "renewed", "Status changed to renewed");
    assert(
      renewRes.data.data.renewalHistory.length === 1,
      "Renewal recorded in renewalHistory audit trail"
    );

    // Re-verify after renewal
    const publicVerifyRenewed = await request(
      `/api/certificates/verify/${verificationId}`
    );
    assert(publicVerifyRenewed.data.isValid === true, "Certificate verified as valid again after renewal");
    assert(publicVerifyRenewed.data.status === "renewed", "Status confirmed renewed");

    // Revocation Workflow
    const revokeRes = await request(`/api/certificates/${certId}/revoke`, {
      method: "POST",
      cookie: instructorCookie,
      body: { reason: "Academic integrity breach investigated and confirmed." },
    });
    assert(revokeRes.status === 200, "Instructor revoked certificate");
    assert(revokeRes.data.data.status === "revoked", "Status updated to revoked");

    const publicVerifyRevoked = await request(
      `/api/certificates/verify/${verificationId}`
    );
    assert(
      publicVerifyRevoked.data.isValid === false && publicVerifyRevoked.data.status === "revoked",
      "Public verification immediately confirms revoked certificate as invalid"
    );

    // -------------------------------------------------------------
    // 4. FEATURE 14: PARENT / GUARDIAN PROGRESS VIEW
    // -------------------------------------------------------------
    console.log("\n--- Testing Feature 14: Parent/Guardian Progress View ---");

    // Student cannot invite themselves
    const selfInvite = await request("/api/guardians/invite", {
      method: "POST",
      cookie: studentCookie,
      body: { guardianEmail: "alice@skillforge.test" },
    });
    assert(selfInvite.status === 400, "Student blocked from inviting own email (400 Bad Request)");

    // Student invites Parent (Robert)
    const inviteRes = await request("/api/guardians/invite", {
      method: "POST",
      cookie: studentCookie,
      body: {
        guardianEmail: "robert.smith@guardian.test",
        relationship: "parent",
        permissions: {
          viewCourses: true,
          viewProgress: true,
          viewCertificates: true,
          viewAttendanceTime: true,
        },
      },
    });
    assert(inviteRes.status === 201, "Student sent guardian invitation");
    const inviteToken = inviteRes.data.data.inviteToken;
    const linkId = inviteRes.data.data.id;
    assert(Boolean(inviteToken), "Generated secure invite token");

    // Parent accepts invitation using invite token
    const acceptRes = await request(`/api/guardians/accept/${inviteToken}`, {
      method: "POST",
      cookie: parentCookie,
    });
    assert(acceptRes.status === 200, "Parent accepted guardian invitation");
    assert(acceptRes.data.data.status === "accepted", "Link status updated to accepted");

    // Parent views linked students
    const linkedStudentsRes = await request("/api/guardians/students", {
      method: "GET",
      cookie: parentCookie,
    });
    assert(linkedStudentsRes.status === 200, "Parent retrieved linked students list");
    assert(linkedStudentsRes.data.count === 1, "Parent has 1 linked student (Alice)");

    // Parent views student's permitted progress
    const progressViewRes = await request(
      `/api/guardians/students/${studentId}/progress`,
      {
        method: "GET",
        cookie: parentCookie,
      }
    );
    assert(progressViewRes.status === 200, "Parent viewed student permitted learning progress");
    const report = progressViewRes.data.data;
    assert(report.student.name === "Alice Smith", "Student name matches");
    assert(report.courses.length === 1, "Enrolled courses listed for parent");
    assert(report.courses[0].progress.percentage === 100, "Student 100% progress visible to parent");
    assert(report.attendanceTime.totalHours >= 0, "Learning time attendance visible");
    assert(report.password === undefined, "Security enforced: Student password strictly excluded");
    assert(report.privateMessages === undefined, "Security enforced: Private messages strictly excluded");

    // Student updates permissions: removes viewCertificates
    const updatePermRes = await request(`/api/guardians/${linkId}/permissions`, {
      method: "PATCH",
      cookie: studentCookie,
      body: {
        permissions: { viewCertificates: false },
      },
    });
    assert(updatePermRes.status === 200, "Student modified guardian permissions");

    // Parent views progress after permission change: certificates omitted
    const progressWithoutCerts = await request(
      `/api/guardians/students/${studentId}/progress`,
      {
        method: "GET",
        cookie: parentCookie,
      }
    );
    assert(
      progressWithoutCerts.data.data.certificates === undefined,
      "Permitted view enforced: Certificates excluded when permission revoked"
    );

    // Student revokes Guardian Access completely
    const revokeLinkRes = await request(`/api/guardians/${linkId}/revoke`, {
      method: "POST",
      cookie: studentCookie,
    });
    assert(revokeLinkRes.status === 200, "Student revoked guardian access");

    // Parent attempts to view progress after revocation
    const blockedParentRes = await request(
      `/api/guardians/students/${studentId}/progress`,
      {
        method: "GET",
        cookie: parentCookie,
      }
    );
    assert(
      blockedParentRes.status === 403,
      "Parent immediately blocked after student revoked access (403 Forbidden)"
    );

    console.log(`\n========================================`);
    console.log(`Phase 5 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
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
