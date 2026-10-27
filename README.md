# ClassSync

ClassSync is an open-source learning management system (LMS). Instructors publish courses with modules, text lessons, downloadable resources and auto-graded quizzes. Students enroll, track their progress, see their grades, and earn verifiable PDF certificates once a course's completion requirements are met.

It is built entirely on free and open-source software and runs on free hosting tiers: **Vercel Hobby** for the app, **Neon Free** for PostgreSQL, and optionally **Cloudflare R2** (free tier) for file attachments.

> Vercel Hobby is limited to personal, non-commercial use. It suits a portfolio deployment of ClassSync. Commercial use requires a paid plan or another host.

## Features

| Area | What's included |
| --- | --- |
| Accounts | Email/password sign-in (Auth.js, bcrypt). Student, instructor and administrator roles. Self-registration creates students; admins promote instructors. |
| Courses | Create, edit, categorize, publish, archive and delete. Markdown descriptions and learning objectives. Draft courses are visible only to their instructor and admins. |
| Content | Ordered modules and lessons, Markdown lesson bodies, per-lesson objectives, estimated time, optional due dates, and downloadable attachments. |
| Enrollment | One-click enrollment for students in published courses. All course content is protected on the server. |
| Quizzes | Multiple-choice questions with point weights. Configurable passing score, attempt limit, due date and required/optional flag. Automatic grading, a stored attempt history, and per-question review after submission. |
| Progress | Lesson completion, course progress, course grade (average best score on required quizzes) and completion status. |
| Certificates | Configurable completion requirements (all lessons, passing required quizzes, minimum grade). The certificate is issued automatically and exactly once. The PDF is generated from the stored record, and a public verification page is included. |
| Instructors | Dashboard with enrollments and completions, a per-course roster with progress and grades, quiz analytics, Recharts charts, and per-student reports. |
| Community | Course announcements, threaded discussions, and in-app deadline and announcement notifications (no email provider needed). |
| Admin | User search and role management, category management, and an overview of all courses. |
| UX | Responsive layouts, search, category filters, pagination, keyboard and screen-reader-friendly forms, and dark mode that follows the OS setting. |

## Tech stack

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · PostgreSQL · Prisma ORM 6 · Auth.js (next-auth v5) · Zod 4 · Recharts · pdf-lib · Vitest · React Testing Library · Playwright · GitHub Actions · Docker Compose.

## Getting started (local development)

Prerequisites: Node.js 20.9 or newer (22 LTS recommended), npm, and Docker (for PostgreSQL).

```bash
git clone <your-fork-url> classsync && cd classsync
cp .env.example .env            # then set AUTH_SECRET (see below)
npm install
docker compose up -d db         # PostgreSQL 16 on localhost:5432
npx prisma migrate deploy       # apply migrations
npm run db:seed                 # demo users, categories and courses
npm run dev                     # http://localhost:3000
```

To generate `AUTH_SECRET`, run `npx auth secret` or `openssl rand -base64 32`.

### Demo accounts (seed data)

All demo accounts share the password `ClassSync123!`. You can override it with `SEED_PASSWORD`.

| Email | Role | State |
| --- | --- | --- |
| `admin@classsync.dev` | Administrator | Manages users, categories, all courses |
| `instructor@classsync.dev` | Instructor | Owns all demo courses (3 published, 1 draft) |
| `student@classsync.dev` | Student | Part-way through *Modern Web Foundations*, with one failed quiz attempt |
| `graduate@classsync.dev` | Student | Has completed *Effective Remote Collaboration* and holds a certificate |

The seed only creates development data. Do not seed a production database with the default password.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Unit and component tests (Vitest, React Testing Library) |
| `npm run test:integration` | Service-level tests against PostgreSQL (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright end-to-end tests (needs a migrated and seeded database) |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` / `db:seed` / `db:reset` | Apply migrations / seed / reset the database |

## Testing

```bash
npm test                                         # unit + component, no database needed

docker compose exec db createdb -U classsync classsync_test
TEST_DATABASE_URL="postgresql://classsync:classsync@localhost:5432/classsync_test" npm run test:integration

npx playwright install chromium
npm run test:e2e                                 # starts `next dev`, uses the seeded DATABASE_URL
```

> **Warning:** integration tests truncate every table in `TEST_DATABASE_URL`. Always point it at a separate, disposable database. The tests apply migrations to it themselves.

What is covered:

- **Grading:** scoring, point weighting, passing thresholds, rejection of incomplete or forged submissions, attempt limits, persisted attempts and responses, stored grades that don't change when questions are later edited, and correct answers never sent to a learner before submission.
- **Enrollment:** published-only, students-only, idempotent and safe under concurrent requests. Catalog search and pagination.
- **Progress and certificates:** lesson completion, progress percentage, rosters, and certificates issued only when the configured requirements (all lessons, passing quizzes, minimum grade) are met, exactly once.
- **Access control:** instructor-only controls, hidden drafts, enrollment-gated content and attachments, discussion moderation, admin-only role changes, and privacy of other students' grades, attempts and certificates.
- **E2E:** the full MVP acceptance flow in a real browser (an instructor builds and publishes a course; a student registers, enrolls, completes a lesson, passes the quiz, checks the grade and progress, and downloads the PDF certificate), role-based redirects, and a phone-sized viewport check.

CI (`.github/workflows/ci.yml`) runs every step on each push and pull request: schema validation, a migration drift check, lint, typecheck, unit/component tests, integration tests, the build and the E2E tests. It uses a PostgreSQL service container.

## Deployment (Vercel Hobby + Neon Free)

1. **Create the database.** Create a free project at [neon.tech](https://neon.tech) and copy two connection strings:
   - the **pooled** string (host contains `-pooler`), which becomes `DATABASE_URL`
   - the **direct** string, which becomes `DIRECT_URL` (Prisma migrations need a direct connection)

   Add `?sslmode=require` to each string if it isn't already there.
2. **Set up file storage** (optional, but needed for attachments in production). Vercel's filesystem is not persistent, so the `local` storage driver is for development only. In Cloudflare, create an R2 bucket (free tier) and an API token with *Object Read & Write* on that bucket. Keep the bucket private: ClassSync streams downloads through an access-checked route.
3. **Import the repository into Vercel** at [vercel.com/new](https://vercel.com/new). The framework is detected as Next.js. Vercel runs the `vercel-build` script, which applies migrations (`prisma migrate deploy`) before `next build`.
4. **Add environment variables** in Vercel → Project → Settings → Environment Variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `AUTH_SECRET` | A long random string (`npx auth secret`) |
   | `APP_URL` | Your deployment URL, for example `https://classsync.vercel.app` |
   | `STORAGE_DRIVER` | `r2` (or `local` to disable persistent uploads) |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | From Cloudflare R2 |
   | `MAX_UPLOAD_MB` | Optional. Default `4`; must stay below Vercel's 4.5 MB request limit |

   Vercel sets `AUTH_TRUST_HOST` automatically. On any other host, set `AUTH_TRUST_HOST=true`.
5. **Deploy**, then create your first administrator. Either:
   - run the seed once against Neon with a strong password: `SEED_PASSWORD='…' DATABASE_URL='<direct url>' npm run db:seed` (this also loads demo courses), or
   - register normally, then promote the account in SQL with Neon's SQL editor:

     ```sql
     UPDATE "User" SET "roleId" = (SELECT id FROM "Role" WHERE name = 'ADMIN') WHERE email = 'you@example.com';
     ```

     Without the seed, first insert the roles: `INSERT INTO "Role" (id, name, description) VALUES ('role_student','STUDENT','Student'),('role_instructor','INSTRUCTOR','Instructor'),('role_admin','ADMIN','Administrator');`

Nothing in ClassSync needs a paid service. There is no video hosting, no email provider, and no third-party LMS or assessment API. Lessons are text (Markdown) with file attachments.

## Architecture

```
prisma/
  schema.prisma            relational model (users, roles, courses, modules, lessons, resources,
                           enrollments, lesson progress, quizzes, questions, choices, attempts,
                           responses, announcements, discussion posts, certificates, categories)
  migrations/              SQL migrations (plus CHECK constraints for scores and attempts)
  seed.ts                  demo data
src/
  auth.ts                  Auth.js configuration (credentials + JWT sessions)
  server/
    policies.ts            pure authorization rules (who can manage, view, enroll, see grades)
    grading.ts             pure grading, progress, course grade and completion evaluation
    services/              domain logic; every function takes (db, actor, input) and enforces access
    actions/               thin Server Actions: session → service → revalidate/redirect
    session.ts             current user, re-read from the database on every request
  lib/
    validation.ts          Zod schemas for every form and submission
    storage/               StorageAdapter with local filesystem and Cloudflare R2 drivers
  app/                     App Router pages: catalog, learn, dashboard, instructor, admin, API routes
  components/              shadcn/ui primitives and app components
tests/                     unit/, components/, integration/ (Vitest)
e2e/                       Playwright specs
```

### Security model

- **Authorization is server-side.** It is enforced in the service layer, not only in the UI. Pages, Server Actions and route handlers all go through the same service functions, which call the policies in `src/server/policies.ts`. The role is re-read from the database on each request, so a role change or deleted account takes effect immediately.
- **Drafts don't leak.** Unpublished courses return *404* to anyone who can't manage them, so their existence isn't revealed. Archived courses stay readable for enrolled learners, but they can't be enrolled in or submitted to.
- **Correct answers stay on the server.** The learner's quiz query selects only `id` and `text` for each choice. `isCorrect` and the explanations go to the browser only on the review page of a submitted attempt. Submissions are validated with Zod and checked server-side: every question must be answered, and every choice must belong to its question. They are graded and stored in a single transaction. A unique `(quizId, userId, attemptNumber)` constraint makes simultaneous submissions safe.
- **Grades are private.** A learner's progress, attempts and certificates are visible only to that learner, the course's instructor, and administrators.
- **Certificates are issued once.** They are issued inside the same transaction that changes progress, and only when `evaluateCompletion` passes. Unique constraints on `enrollmentId` and `(userId, courseId)` guarantee a single certificate. Each certificate stores snapshots (recipient, course, instructor, grade), and the PDF is rendered from that record.
- **Uploads are restricted.** Attachments are limited by extension allow-list and size. They are stored under server-generated keys and served only after an enrollment check, with `Content-Disposition: attachment` and `nosniff`.
- **Other measures.** Passwords use bcrypt, and sign-in takes the same time whether or not the account exists. Post-login redirects must be same-site. Markdown is rendered without raw HTML.

## License

MIT
