import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_phase6_123456";

const TEST_PORT = 5065;
const MONGO_PORT = 27023;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db_phase6");
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
  console.log("=== STARTING PHASE 6 TESTS: Organization LMS & Tenant Isolation ===");

  await startMongo();
  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_phase6`);

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // -------------------------------------------------------------
    // 1. SETUP USERS: System Admin, Org Admin A, Org Admin B, Student
    // -------------------------------------------------------------
    console.log("\n--- Setting up Accounts & Roles ---");
    // System Admin
    const sysAdminReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "System Superadmin",
        email: "superadmin@skillforge.test",
        password: "Password123!",
      },
    });
    const sysAdminCookie = sysAdminReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "superadmin@skillforge.test" },
      { $set: { role: "admin" } }
    );
    assert(sysAdminReg.status === 201, "System Superadmin registered");

    // Standard Student
    const studentReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Independent Student",
        email: "student@skillforge.test",
        password: "Password123!",
      },
    });
    const studentCookie = studentReg.cookie;
    assert(studentReg.status === 201, "Independent student registered");

    // Course Instructor
    const instReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Dr. Walter Lewin",
        email: "walter@skillforge.test",
        password: "Password123!",
      },
    });
    const instructorCookie = instReg.cookie;
    await mongoose.connection.collection("users").updateOne(
      { email: "walter@skillforge.test" },
      { $set: { role: "instructor" } }
    );
    assert(instReg.status === 201, "Instructor registered");

    // Create a base course to assign to organizations
    const courseRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Classical Mechanics & Computational Physics",
        description: "Newtonian mechanics and simulations.",
        shortDescription: "Physics and mechanics",
        price: 150,
        category: "Physics",
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
        title: "Lesson 1: Vectors & Kinematics",
        description: "Vector operations in 3D coordinate systems.",
        duration: 40,
        order: 1,
      },
    });
    const lesson1Id = l1Res.data.data.lesson._id;
    await request(`/api/lessons/${lesson1Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });
    assert(l1Res.status === 201, "Lesson 1 created and published");

    // -------------------------------------------------------------
    // 2. FEATURE 15: ORGANIZATION CREATION & PERMISSIONS
    // -------------------------------------------------------------
    console.log("\n--- Testing Organization Creation & Role Permissions ---");

    // Non-admin cannot create organization
    const unauthOrgCreate = await request("/api/organizations", {
      method: "POST",
      cookie: studentCookie,
      body: {
        name: "Unauthorized College",
        slug: "unauthorized-college",
        code: "UNAUTH-COL",
      },
    });
    assert(
      unauthOrgCreate.status === 403,
      "Student blocked from creating organization (403 Forbidden)"
    );

    // System Admin creates Organization A (MIT) with designated Org Admin
    const orgARes = await request("/api/organizations", {
      method: "POST",
      cookie: sysAdminCookie,
      body: {
        name: "MIT School of Engineering",
        slug: "mit-engineering",
        code: "MIT-ENG",
        domain: "mit.edu",
        description: "Premier engineering institute tenant.",
        adminEmail: "dean.eng@mit.test",
        maxStudents: 50,
      },
    });
    assert(orgARes.status === 201, "System Admin created Organization A (MIT)");
    const orgAId = orgARes.data.data._id;
    assert(Boolean(orgAId), "Organization A generated valid ID");

    // System Admin creates Organization B (Stanford) with designated Org Admin
    const orgBRes = await request("/api/organizations", {
      method: "POST",
      cookie: sysAdminCookie,
      body: {
        name: "Stanford Computer Science",
        slug: "stanford-cs",
        code: "STANFORD-CS",
        domain: "stanford.edu",
        description: "Stanford computing tenant.",
        adminEmail: "dept.head@stanford.test",
        maxStudents: 100,
      },
    });
    assert(orgBRes.status === 201, "System Admin created Organization B (Stanford)");
    const orgBId = orgBRes.data.data._id;

    // Duplicate slug/code conflict test
    const dupRes = await request("/api/organizations", {
      method: "POST",
      cookie: sysAdminCookie,
      body: {
        name: "Duplicate Org",
        slug: "mit-engineering",
        code: "MIT-ENG",
      },
    });
    assert(dupRes.status === 409, "Duplicate organization slug rejected (409 Conflict)");

    // Log in as Org Admin A (dean.eng@mit.test)
    const orgAdminALogin = await request("/api/auth/login", {
      method: "POST",
      body: {
        email: "dean.eng@mit.test",
        password: "OrgAdmin123!",
      },
    });
    assert(orgAdminALogin.status === 200, "Org Admin A logged in successfully");
    const orgAdminACookie = orgAdminALogin.cookie;

    // Log in as Org Admin B (dept.head@stanford.test)
    const orgAdminBLogin = await request("/api/auth/login", {
      method: "POST",
      body: {
        email: "dept.head@stanford.test",
        password: "OrgAdmin123!",
      },
    });
    assert(orgAdminBLogin.status === 200, "Org Admin B logged in successfully");
    const orgAdminBCookie = orgAdminBLogin.cookie;

    // -------------------------------------------------------------
    // 3. TENANT ISOLATION ENFORCEMENT
    // -------------------------------------------------------------
    console.log("\n--- Testing Strict Tenant-Level Data Isolation ---");

    // Org Admin A accesses own Organization A
    const orgAGet = await request(`/api/organizations/${orgAId}`, {
      method: "GET",
      cookie: orgAdminACookie,
    });
    assert(orgAGet.status === 200, "Org Admin A can view own Organization A");
    assert(orgAGet.data.data.name === "MIT School of Engineering", "Organization A details match");

    // Org Admin A attempts to access Organization B -> STRICTLY FORBIDDEN
    const crossTenantGet = await request(`/api/organizations/${orgBId}`, {
      method: "GET",
      cookie: orgAdminACookie,
    });
    assert(
      crossTenantGet.status === 403,
      "Tenant Isolation Enforced: Org Admin A blocked from viewing Organization B (403 Forbidden)"
    );

    // Org Admin A attempts to modify Organization B
    const crossTenantUpdate = await request(`/api/organizations/${orgBId}`, {
      method: "PUT",
      cookie: orgAdminACookie,
      body: { name: "Malicious Tampering" },
    });
    assert(
      crossTenantUpdate.status === 403,
      "Tenant Isolation Enforced: Org Admin A blocked from modifying Organization B (403 Forbidden)"
    );

    // Org Admin A attempts to bulk-enroll into Organization B
    const crossTenantBulkEnroll = await request(`/api/organizations/${orgBId}/bulk-enroll`, {
      method: "POST",
      cookie: orgAdminACookie,
      body: {
        courseIds: [courseId],
        students: [{ email: "hacker@mit.test" }],
      },
    });
    assert(
      crossTenantBulkEnroll.status === 403,
      "Tenant Isolation Enforced: Org Admin A blocked from enrolling into Organization B (403 Forbidden)"
    );

    // -------------------------------------------------------------
    // 4. CURRICULUM ASSIGNMENT & ROSTER MANAGEMENT
    // -------------------------------------------------------------
    console.log("\n--- Testing Course Assignment & Organization Roster ---");

    // Org Admin A assigns course to Org A curriculum
    const assignCourseRes = await request(`/api/organizations/${orgAId}/courses`, {
      method: "POST",
      cookie: orgAdminACookie,
      body: { courseId },
    });
    assert(assignCourseRes.status === 200, "Course assigned to Organization A curriculum");

    // Org Admin A adds an instructor to Org A
    const addInstRes = await request(`/api/organizations/${orgAId}/members`, {
      method: "POST",
      cookie: orgAdminACookie,
      body: {
        email: "walter@skillforge.test",
        role: "instructor",
      },
    });
    assert(addInstRes.status === 200, "Instructor added to Organization A roster");

    // Verify members list
    const membersRes = await request(`/api/organizations/${orgAId}/members`, {
      method: "GET",
      cookie: orgAdminACookie,
    });
    assert(membersRes.status === 200, "Retrieved Organization A members roster");
    assert(membersRes.data.count >= 1, "Roster contains assigned members");

    // -------------------------------------------------------------
    // 5. BULK STUDENT ENROLLMENT
    // -------------------------------------------------------------
    console.log("\n--- Testing Bulk Student Enrollment ---");

    const batchStudents = [
      { email: "john.mit@mit.test", name: "John Doe" },
      { email: "emma.mit@mit.test", name: "Emma Watson" },
      { email: "student@skillforge.test", name: "Independent Student" }, // existing user
    ];

    const bulkEnrollRes = await request(`/api/organizations/${orgAId}/bulk-enroll`, {
      method: "POST",
      cookie: orgAdminACookie,
      body: {
        courseIds: [courseId],
        students: batchStudents,
      },
    });
    assert(bulkEnrollRes.status === 200, "Bulk enrollment executed successfully");
    assert(bulkEnrollRes.data.data.totalProcessed === 3, "Batch processed 3 students");
    assert(bulkEnrollRes.data.data.enrolledCount >= 3, "Created 3 course enrollments");
    assert(bulkEnrollRes.data.data.failedCount === 0, "Zero failures during bulk enrollment");

    // Check that auto-provisioned student can log in with default credentials
    const newStudentLogin = await request("/api/auth/login", {
      method: "POST",
      body: {
        email: "john.mit@mit.test",
        password: "Student123!",
      },
    });
    assert(newStudentLogin.status === 200, "Auto-provisioned student can log in with temporary credentials");
    const johnCookie = newStudentLogin.cookie;

    // Verify student is automatically enrolled with active access
    const myCoursesRes = await request("/api/students/my-courses", {
      method: "GET",
      cookie: johnCookie,
    });
    assert(myCoursesRes.status === 200, "Student fetched enrolled courses");
    assert(myCoursesRes.data.data.courses.length >= 1, "Student has active course access via bulk enrollment");

    // Complete Lesson 1 as John to generate progress & analytics
    await request(`/api/progress/${courseId}/lessons/${lesson1Id}/complete`, {
      method: "POST",
      cookie: johnCookie,
    });

    // Record active learning time for John
    await request("/api/learning-time/heartbeat", {
      method: "POST",
      cookie: johnCookie,
      body: {
        courseId,
        lessonId: lesson1Id,
        durationSeconds: 60,
      },
    });

    // -------------------------------------------------------------
    // 6. TENANT-LEVEL ANALYTICS
    // -------------------------------------------------------------
    console.log("\n--- Testing Tenant-Level Analytics Dashboard ---");

    const analyticsRes = await request(`/api/organizations/${orgAId}/analytics`, {
      method: "GET",
      cookie: orgAdminACookie,
    });
    assert(analyticsRes.status === 200, "Org Admin fetched Organization A analytics");
    const analyticsData = analyticsRes.data.data;
    assert(analyticsData.summary.totalStudents >= 3, "Analytics accurately tracks enrolled students count");
    assert(analyticsData.summary.totalCourses === 1, "Analytics tracks 1 assigned curriculum course");
    assert(analyticsData.summary.activeEnrollmentsCount >= 3, "Analytics tracks active enrollments");
    assert(analyticsData.summary.totalLearningHours >= 0, "Analytics tracks aggregated learning hours");
    assert(analyticsData.courseBreakdown.length === 1, "Course breakdown includes assigned course");
    assert(
      analyticsData.courseBreakdown[0].enrolledStudents >= 3,
      "Course breakdown tracks student enrollment volume"
    );

    // Cross-tenant analytics protection
    const crossTenantAnalytics = await request(`/api/organizations/${orgBId}/analytics`, {
      method: "GET",
      cookie: orgAdminACookie,
    });
    assert(
      crossTenantAnalytics.status === 403,
      "Tenant Isolation Enforced: Org Admin A blocked from viewing Org B analytics (403 Forbidden)"
    );

    console.log(`\n========================================`);
    console.log(`Phase 6 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
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
