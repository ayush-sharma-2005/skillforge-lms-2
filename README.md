# SkillForge LMS 🎓

> **An advanced, scalable, full-stack Learning Management System built using the MERN stack with TypeScript.**

---

## 🌟 Key Features

1. **Learning Path Prerequisites**: Sequenced multi-course paths with automatic unlocking upon prerequisite completion.
2. **Course Drip Content**: Date-based and enrollment-day release scheduling with locked video concealment.
3. **Offline Learning & Secure Downloads**: 15-minute time-limited signed JWT download tokens with IP and count audit tracking.
4. **Multi-Language Support**: Complete translations for courses and lesson content with graceful fallback to default language.
5. **Lesson Discussions & Threading**: Threaded Q&A per lesson, nested replies, instructor verification badges, and moderation flags.
6. **Plagiarism Detection for Assignments**: N-gram shingle Jaccard text & code similarity comparison across cohort submissions with non-punitive instructor review flagging.
7. **AI-Based Assignment Evaluation**: Configurable AI evaluator supporting Google Gemini API with fallback heuristic rubric grading and instructor approval/override.
8. **Peer-to-Peer Code Review**: Automated round-robin peer distribution (`reviewer != author`), inline line-by-line code comments, and peer grading.
9. **Instructor Live Analytics**: Real-time database aggregations: active students, lesson completion funnels, attrition/drop-off analysis, and discussion metrics.
10. **Learning Accessibility (WCAG 2.1 AA)**: Video captions, transcripts, audio descriptions, keyboard navigation, and screen-reader semantic context.
11. **Course Version Management**: Immutable curriculum snapshots, grandfathered version preservation for enrolled students, and deep version comparison diffs.
12. **Certificate Expiry & Renewal**: 100% completion verified issuance, unique verification IDs, public verification endpoint (`/api/certificates/verify/:id`), and renewal audit workflows.
13. **Learning Time Analytics**: Active study time tracking via periodic heartbeats with 120s idle protection and student summaries.
14. **Parent/Guardian Progress View**: Student invitation and consent workflow, read-only academic progress, granular permissions, and strict privacy isolation.
15. **Organization/College Multi-Tenant Dashboard**: College & company portals, `org_admin` role, strict tenant isolation middleware, bulk student enrollment, and organization-scoped analytics.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ / 22+
- **Backend Framework**: Express 5
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Validation**: Zod
- **Security**: JWT, bcryptjs, Helmet, CORS, Rate Limiting, Cookie-Parser
- **Testing**: Native integration test suite with tsx (222 / 222 tests passing)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/skillforge-lms.git
cd skillforge-lms/server
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment configuration
Create a `.env` file inside the `server/` directory:
```bash
cp .env.example .env
```
Fill in your configuration:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/skillforge_lms
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🧪 Testing

The platform includes comprehensive end-to-end integration test suites covering all 6 phases:

```bash
# Run individual phase tests
npm run test:phase1   # Prerequisites & Course Drip Content (32 tests)
npm run test:phase2   # Discussions, Multi-Language & Learning Time (26 tests)
npm run test:phase3   # Downloads, Accessibility & Versioning (18 tests)
npm run test:phase4   # Assignments, Plagiarism, AI & Peer Reviews (51 tests)
npm run test:phase5   # Live Analytics, Certificates & Guardians (59 tests)
npm run test:phase6   # Multi-Tenancy, Bulk Enrollment & Isolation (36 tests)

# Typecheck
npm run typecheck
```
*Total: 222 / 222 automated integration tests passing.*

---

## 📄 License
ISC License
