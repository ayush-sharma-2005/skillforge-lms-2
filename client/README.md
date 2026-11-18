# SkillForge LMS: Client

React + Vite + TypeScript + Tailwind CSS v4 frontend for the SkillForge API in `../server`.

## Run

```bash
# 1. Start the API (in ../server)
npm run dev            # http://localhost:5000

# 2. Start the client
cd client
npm install
npm run dev            # http://localhost:5173
```

In dev, Vite proxies `/api` to `http://localhost:5000`, so the httpOnly `sf_token` cookie stays same-origin.
To use another API origin, set `VITE_API_URL` (client) or `VITE_API_PROXY_TARGET` (dev proxy).

## Scripts

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `npm run dev`       | Dev server on port 5173       |
| `npm run typecheck` | Strict TypeScript check       |
| `npm run lint`      | oxlint                        |
| `npm run build`     | Typecheck + production build  |

## Structure

```
src/
  components/ui/      Button, Field, Checkbox, Card, Feedback (Skeleton, Badge, Progress, EmptyState, ErrorState), ProgressRing
  components/layout/  AppShell, Sidebar, role-based nav
  components/auth/    Split-screen AuthLayout + network illustration
  context/            AuthContext, ThemeContext
  features/           auth/, student/, home/
  lib/                api client, formatting helpers
  routes/             ProtectedRoute, SessionGate
```

## Theme

Warm brown / tan / cream tokens live in `src/index.css` (`:root` and `.dark`). Components use semantic
classes (`bg-surface`, `text-foreground`, `bg-brand-gradient`), so never hardcode colors.

## Built so far

Login, Register, Forgot/Reset password, app shell (collapsible sidebar, mobile drawer, light/dark),
and the student dashboard. Nav items marked "Soon" are pages not built yet.
