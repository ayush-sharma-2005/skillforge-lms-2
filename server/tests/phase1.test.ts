import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_for_skillforge_tests_123456";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import mongoose from "mongoose";
import app from "../src/app";

const TEST_PORT = 5055;
const MONGO_PORT = 27018;
const DB_PATH = path.join(__dirname, "..", ".test_mongo_db");
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

  await mongoose.connect(`mongodb://127.0.0.1:${MONGO_PORT}/skillforge_test`);
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
    await sleep(1000);
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
  console.log("   SKILLFORGE LMS — PHASE 1 INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  await startMongo();

  serverInstance = app.listen(TEST_PORT);
  await sleep(500);

  try {
    // ---------------------------------------------------------
    // 1. Health check & Server Boot
    // ---------------------------------------------------------
    console.log("[Test Group 1] Server Health & Initial State");
    const health = await request("/api/health");
    assert(health.status === 200 && health.data.success === true, "Health endpoint responds 200 OK");

    // ---------------------------------------------------------
    // 2. Authentication & User Creation
    // ---------------------------------------------------------
    console.log("\n[Test Group 2] Authentication & Roles");
    const instructorReg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Instructor Alice",
        email: "alice@skillforge.test",
        password: "Password123!",
      },
    });
    assert(instructorReg.status === 201, "Register instructor account");
    const instructorCookie = instructorReg.cookie;

    // Promote to instructor role in DB directly for test
    await mongoose.connection.collection("users").updateOne(
      { email: "alice@skillforge.test" },
      { $set: { role: "instructor" } }
    );

    const student1Reg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Student Bob",
        email: "bob@skillforge.test",
        password: "Password123!",
      },
    });
    assert(student1Reg.status === 201, "Register student Bob");
    const student1Cookie = student1Reg.cookie;

    const student2Reg = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Student Charlie",
        email: "charlie@skillforge.test",
        password: "Password123!",
      },
    });
    assert(student2Reg.status === 201, "Register student Charlie");
    const student2Cookie = student2Reg.cookie;

    // ---------------------------------------------------------
    // 3. Course Creation & Course Prerequisites
    // ---------------------------------------------------------
    console.log("\n[Test Group 3] Course Creation & Prerequisite Assignment");
    // Create Course A (Foundation)
    const courseARes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Course A: Programming Fundamentals",
        description: "Complete foundations of computer programming and algorithms.",
        shortDescription: "Fundamentals of coding.",
        price: 0,
        category: "Computer Science",
        level: "beginner",
      },
    });
    assert(courseARes.status === 201, "Instructor creates Course A (Foundation)");
    const courseAId = courseARes.data.data.course._id;

    // Publish Course A
    await request(`/api/courses/${courseAId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Create Course B with Course A as prerequisite
    const courseBRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Course B: Advanced Data Structures",
        description: "In-depth study of trees, graphs, and dynamic programming.",
        shortDescription: "Advanced algorithms and data structures.",
        price: 0,
        category: "Computer Science",
        level: "intermediate",
        prerequisites: [courseAId],
      },
    });
    assert(courseBRes.status === 201, "Instructor creates Course B with Course A as prerequisite");
    const courseBId = courseBRes.data.data.course._id;

    // Publish Course B
    await request(`/api/courses/${courseBId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // ---------------------------------------------------------
    // 4. Public Course Route Bug Fix Verification
    // ---------------------------------------------------------
    console.log("\n[Test Group 4] Public Single-Course Route Verification");
    const publicCourseA = await request(`/api/courses/${courseAId}`);
    assert(
      publicCourseA.status === 200 && publicCourseA.data.data.course.title === "Course A: Programming Fundamentals",
      "Unauthenticated guest can access GET /api/courses/:id (Bug Fix Verified)"
    );

    // ---------------------------------------------------------
    // 5. Backend Prerequisite Enforcement on Direct Course Enrollment
    // ---------------------------------------------------------
    console.log("\n[Test Group 5] Backend Prerequisite Validation on Course Enrollment");
    // Bob tries to enroll in Course B without completing Course A
    const blockedEnroll = await request(`/api/enrollments/${courseBId}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(
      blockedEnroll.status === 403 && blockedEnroll.data.unmetPrerequisites?.length > 0,
      "Enrollment in Course B rejected (403 Forbidden: Prerequisites not met)"
    );

    // Bob enrolls in Course A
    const enrollCourseA = await request(`/api/enrollments/${courseAId}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(enrollCourseA.status === 201, "Bob enrolls in Course A (prerequisites met)");

    // Add lessons to Course A
    const lessonA1 = await request(`/api/lessons/${courseAId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson A1: Variables & Expressions",
        description: "Learn about memory, variables, and expressions.",
        videoUrl: "https://videos.skillforge.test/a1.mp4",
        duration: 300,
        order: 1,
      },
    });
    const lessonA1Id = lessonA1.data.data.lesson._id;
    await request(`/api/lessons/${lessonA1Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    const lessonA2 = await request(`/api/lessons/${courseAId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson A2: Control Flow & Loops",
        description: "Learn about if statements and while/for loops.",
        videoUrl: "https://videos.skillforge.test/a2.mp4",
        duration: 400,
        order: 2,
      },
    });
    const lessonA2Id = lessonA2.data.data.lesson._id;
    await request(`/api/lessons/${lessonA2Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Bob completes only Lesson A1
    await request(`/api/progress/${courseAId}/${lessonA1Id}`, {
      method: "POST",
      cookie: student1Cookie,
    });

    // Course A is partially completed (50%). Enrollment in Course B must still be blocked!
    const stillBlockedEnroll = await request(`/api/enrollments/${courseBId}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(
      stillBlockedEnroll.status === 403,
      "Enrollment in Course B blocked when Course A is only partially completed (50%)"
    );

    // Bob completes Lesson A2 (Course A is now 100% completed)
    const completeA2 = await request(`/api/progress/${courseAId}/${lessonA2Id}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    if (completeA2.status !== 200) {
      console.log("DEBUG completeA2:", completeA2.status, completeA2.data, "lessonA2Id:", lessonA2Id);
    }
    assert(
      completeA2.status === 200 && completeA2.data.data.percentage === 100,
      "Bob completes Lesson A2, achieving 100% completion in Course A"
    );

    // Now Bob enrolls in Course B -> MUST SUCCEED!
    const allowedEnroll = await request(`/api/enrollments/${courseBId}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(
      allowedEnroll.status === 201,
      "Bob successfully enrolls in Course B after fulfilling Course A prerequisite"
    );

    // ---------------------------------------------------------
    // 6. Course Drip Content Testing
    // ---------------------------------------------------------
    console.log("\n[Test Group 6] Course Drip Content (Date & Enrollment-based Scheduling)");
    // Add lessons to Course B with drip schedules
    // Lesson B1: Immediate
    const lessonB1 = await request(`/api/lessons/${courseBId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson B1: Orientation & Stacks",
        description: "Welcome to advanced data structures.",
        videoUrl: "https://videos.skillforge.test/b1.mp4",
        duration: 250,
        order: 1,
        dripType: "none",
      },
    });
    const lessonB1Id = lessonB1.data.data.lesson._id;
    await request(`/api/lessons/${lessonB1Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Lesson B2: Date-based in the future (Locked)
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const lessonB2 = await request(`/api/lessons/${courseBId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson B2: Balanced Binary Trees",
        description: "Full guide to AVL and Red-Black trees.",
        videoUrl: "https://videos.skillforge.test/b2.mp4",
        duration: 600,
        order: 2,
        dripType: "date",
        unlockDate: futureDate,
      },
    });
    const lessonB2Id = lessonB2.data.data.lesson._id;
    await request(`/api/lessons/${lessonB2Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Lesson B3: Enrollment-days based (e.g. unlocks 10 days after enrollment -> Locked)
    const lessonB3 = await request(`/api/lessons/${courseBId}`, {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Lesson B3: Graph Algorithms",
        description: "Dijkstra and Bellman-Ford algorithms.",
        videoUrl: "https://videos.skillforge.test/b3.mp4",
        duration: 800,
        order: 3,
        dripType: "enrollment_days",
        unlockAfterDays: 10,
      },
    });
    const lessonB3Id = lessonB3.data.data.lesson._id;
    await request(`/api/lessons/${lessonB3Id}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Bob (student) fetches Course B lessons
    const bobCourseBLessons = await request(`/api/lessons/course/${courseBId}`, {
      cookie: student1Cookie,
    });
    const lessonsData = bobCourseBLessons.data.data.lessons;

    assert(
      lessonsData[0].isLocked === false && lessonsData[0].videoUrl === "https://videos.skillforge.test/b1.mp4",
      "Immediate lesson B1 is unlocked with accessible video URL"
    );

    assert(
      lessonsData[1].isLocked === true &&
        lessonsData[1].videoUrl === null &&
        Boolean(lessonsData[1].availableAt),
      "Date-drip lesson B2 is locked with video URL hidden and release date displayed"
    );

    assert(
      lessonsData[2].isLocked === true &&
        lessonsData[2].videoUrl === null &&
        Boolean(lessonsData[2].availableAt),
      "Enrollment-days drip lesson B3 is locked with release date 10 days after enrollment"
    );

    // Student attempts to complete locked lesson B2 -> MUST FAIL 403
    const blockedCompleteB2 = await request(`/api/progress/${courseBId}/${lessonB2Id}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(
      blockedCompleteB2.status === 403,
      "Student cannot complete locked drip lesson B2 (403 Forbidden)"
    );

    // Student completes unlocked lesson B1 -> SUCCEEDS
    const successCompleteB1 = await request(`/api/progress/${courseBId}/${lessonB1Id}`, {
      method: "POST",
      cookie: student1Cookie,
    });
    assert(successCompleteB1.status === 200, "Student successfully completes unlocked lesson B1");

    // Instructor fetches Course B lessons -> Must see ALL lessons unlocked with drip config visible
    const instructorCourseBLessons = await request(`/api/lessons/course/${courseBId}`, {
      cookie: instructorCookie,
    });
    const instLessons = instructorCourseBLessons.data.data.lessons;
    assert(
      instLessons.every((l: any) => l.isLocked === false && l.videoUrl !== null),
      "Instructor has full preview access to all drip-scheduled lessons"
    );

    // ---------------------------------------------------------
    // 7. Learning Path Prerequisite System
    // ---------------------------------------------------------
    console.log("\n[Test Group 7] Learning Path Sequence & Prerequisites");

    // Create Course C
    const courseCRes = await request("/api/courses", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Course C: Full-Stack System Design",
        description: "Large scale web application architectures and microservices.",
        shortDescription: "System design mastery.",
        price: 0,
        category: "Computer Science",
        level: "advanced",
      },
    });
    const courseCId = courseCRes.data.data.course._id;
    await request(`/api/courses/${courseCId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Test cyclic / invalid prerequisite validation on Learning Path creation
    const invalidPath = await request("/api/learning-paths", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Invalid Path",
        description: "Testing cyclic prerequisite rejection.",
        category: "Computer Science",
        level: "intermediate",
        courses: [
          { course: courseBId, order: 1, prerequisites: [courseAId] }, // Course A appears after Course B in order!
          { course: courseAId, order: 2, prerequisites: [] },
        ],
      },
    });
    assert(
      invalidPath.status === 400,
      "Learning path creation rejects out-of-order/future prerequisite references (400 Bad Request)"
    );

    // Create valid Learning Path
    const validPathRes = await request("/api/learning-paths", {
      method: "POST",
      cookie: instructorCookie,
      body: {
        title: "Full-Stack Software Engineer Career Path",
        description: "Comprehensive step-by-step path from programming foundations to advanced system design.",
        category: "Computer Science",
        level: "beginner",
        courses: [
          { course: courseAId, order: 1, prerequisites: [] },
          { course: courseBId, order: 2, prerequisites: [courseAId] },
          { course: courseCId, order: 3, prerequisites: [courseBId] },
        ],
      },
    });
    assert(validPathRes.status === 201, "Instructor creates sequenced Learning Path with multi-tier prerequisites");
    const pathId = validPathRes.data.data.learningPath._id;

    // Publish Learning Path
    await request(`/api/learning-paths/${pathId}/publish`, {
      method: "PATCH",
      cookie: instructorCookie,
    });

    // Charlie (fresh student who has completed nothing) views path progress
    const charlieProgressBefore = await request(`/api/learning-paths/${pathId}/progress`, {
      cookie: student2Cookie,
    });
    const charlieCourses = charlieProgressBefore.data.data.courses;

    assert(
      charlieCourses[0].isUnlocked === true && charlieCourses[0].status === "available",
      "Course A is unlocked and available for new student Charlie"
    );

    assert(
      charlieCourses[1].isUnlocked === false &&
        charlieCourses[1].status === "locked" &&
        charlieCourses[1].unmetPrerequisites[0].courseId === courseAId,
      "Course B is locked for Charlie (unmet prerequisite: Course A)"
    );

    assert(
      charlieCourses[2].isUnlocked === false &&
        charlieCourses[2].status === "locked" &&
        charlieCourses[2].unmetPrerequisites[0].courseId === courseBId,
      "Course C is locked for Charlie (unmet prerequisite: Course B)"
    );

    // Charlie enrolls in the Learning Path
    const enrollPathRes = await request(`/api/learning-paths/${pathId}/enroll`, {
      method: "POST",
      cookie: student2Cookie,
    });
    assert(
      enrollPathRes.status === 200 && enrollPathRes.data.data.autoEnrolledCourses.includes(courseAId),
      "Charlie enrolls in Learning Path and is auto-enrolled in initial unlocked Course A"
    );

    // Charlie verifies course access endpoint in path
    const checkAccessBefore = await request(`/api/learning-paths/${pathId}/courses/${courseBId}/access`, {
      cookie: student2Cookie,
    });
    assert(
      checkAccessBefore.status === 200 && checkAccessBefore.data.data.isUnlocked === false,
      "Access check confirms Course B is locked for Charlie"
    );

    // Charlie completes Course A (Lessons A1 and A2)
    await request(`/api/progress/${courseAId}/${lessonA1Id}`, {
      method: "POST",
      cookie: student2Cookie,
    });
    await request(`/api/progress/${courseAId}/${lessonA2Id}`, {
      method: "POST",
      cookie: student2Cookie,
    });

    // Check Charlie's path progress after completing Course A
    const charlieProgressAfter = await request(`/api/learning-paths/${pathId}/progress`, {
      cookie: student2Cookie,
    });
    const updatedCourses = charlieProgressAfter.data.data.courses;

    assert(
      updatedCourses[0].status === "completed" && updatedCourses[0].progress.percentage === 100,
      "Course A is marked completed (100%) in Charlie's learning path"
    );

    assert(
      updatedCourses[1].isUnlocked === true && updatedCourses[1].status === "available",
      "Course B AUTOMATICALLY UNLOCKED after Charlie completed Course A prerequisites!"
    );

    assert(
      updatedCourses[2].isUnlocked === false && updatedCourses[2].status === "locked",
      "Course C remains locked until Course B is completed"
    );

    // Check Charlie's dashboard learning paths
    const studentPaths = await request("/api/learning-paths/student/my-paths", {
      cookie: student2Cookie,
    });
    assert(
      studentPaths.status === 200 && studentPaths.data.data.learningPaths.length > 0,
      "Student dashboard lists enrolled learning paths with course progression"
    );

    // ---------------------------------------------------------
    // 8. Authorization & Security Checks
    // ---------------------------------------------------------
    console.log("\n[Test Group 8] Security, Ownership & Role-Based Authorization");
    // Student Bob attempts to create a learning path -> 403 Forbidden
    const studentCreatePath = await request("/api/learning-paths", {
      method: "POST",
      cookie: student1Cookie,
      body: {
        title: "Hacked Path",
        description: "Student trying to act as instructor.",
        category: "Hacking",
        courses: [],
      },
    });
    assert(
      studentCreatePath.status === 403,
      "Student blocked from creating learning paths (403 Forbidden)"
    );

    // Student Bob attempts to modify instructor's learning path -> 403 Forbidden
    const studentUpdatePath = await request(`/api/learning-paths/${pathId}`, {
      method: "PATCH",
      cookie: student1Cookie,
      body: {
        title: "Defaced Title",
      },
    });
    assert(
      studentUpdatePath.status === 403,
      "Student blocked from updating instructor's learning path (403 Forbidden)"
    );

    // Unauthenticated request to protected endpoint -> 401 Unauthorized
    const unauthRequest = await request(`/api/learning-paths/${pathId}/enroll`, {
      method: "POST",
    });
    assert(
      unauthRequest.status === 401,
      "Unauthenticated request to protected endpoint rejected (401 Unauthorized)"
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
