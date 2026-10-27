/**
 * Development seed data. Safe to re-run: demo users are upserted and demo courses are recreated.
 * Demo accounts share the password in SEED_PASSWORD (default "ClassSync123!"). Never seed production
 * with the default password.
 */
import { PrismaClient, type RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
import { gradeSubmission } from "../src/server/grading";
import { syncCompletion } from "../src/server/services/progress";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "ClassSync123!";
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

type QuestionSeed = { prompt: string; explanation: string; choices: string[]; correct: number };
type LessonSeed = { title: string; content: string; objectives: string[]; minutes: number; dueInDays?: number };
type ModuleSeed = {
  title: string;
  lessons: LessonSeed[];
  quiz?: { title: string; description: string; passingScore: number; maxAttempts: number | null; dueInDays?: number; questions: QuestionSeed[] };
};
type CourseSeed = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  objectives: string[];
  category: string;
  status: "DRAFT" | "PUBLISHED";
  minimumGrade?: number;
  modules: ModuleSeed[];
};

const lesson = (title: string, intro: string, points: string[], minutes: number, dueInDays?: number): LessonSeed => ({
  title,
  minutes,
  dueInDays,
  objectives: points.slice(0, 3).map((p) => p.replace(/\*\*/g, "")),
  content: `## ${title}\n\n${intro}\n\n### Key ideas\n\n${points.map((p) => `- ${p}`).join("\n")}\n\n### Try it yourself\n\nWrite down one example of each key idea from a project you have worked on, then compare your notes with the discussion board.\n`,
});

const courses: CourseSeed[] = [
  {
    slug: "modern-web-foundations",
    title: "Modern Web Foundations",
    summary: "Learn how the web works and build accessible pages with semantic HTML, modern CSS and JavaScript.",
    description:
      "A practical introduction to front-end development. You will learn how browsers turn HTML, CSS and JavaScript into interactive pages, how to structure content semantically, and how to write maintainable styles and scripts.\n\nEach module ends with a short quiz. Pass both quizzes and complete every lesson to earn your certificate.",
    objectives: ["Explain the request/response cycle", "Write semantic, accessible HTML", "Lay out pages with Flexbox and Grid", "Manipulate the DOM with JavaScript"],
    category: "Web Development",
    status: "PUBLISHED",
    minimumGrade: 70,
    modules: [
      {
        title: "HTML & CSS",
        lessons: [
          lesson("How the Web Works", "Every page you visit starts with an HTTP request. The server responds with HTML, which the browser parses into the DOM.", ["**HTTP** is a request/response protocol between clients and servers.", "**DNS** resolves human-readable domains to IP addresses.", "Browsers parse HTML into the **DOM** and CSS into the **CSSOM**.", "Rendering combines both into a layout that is painted on screen."], 15, 3),
          lesson("Semantic HTML", "Semantic elements describe meaning, not appearance. They make pages accessible to screen readers and easier to maintain.", ["Use `<header>`, `<nav>`, `<main>` and `<footer>` for page landmarks.", "Headings form an outline: never skip levels.", "Every form control needs an associated `<label>`.", "Images need meaningful `alt` text, or an empty one when decorative."], 20),
          lesson("Layout with Flexbox and Grid", "Modern CSS layout is built on two tools: Flexbox for one-dimensional layouts and Grid for two-dimensional ones.", ["Flexbox distributes space along a single axis.", "Grid places items into rows and columns at the same time.", "`gap` adds consistent spacing without margins.", "Media queries adapt layouts to different screen sizes."], 25),
        ],
        quiz: {
          title: "HTML & CSS Check",
          description: "Three questions on the fundamentals covered in this module.",
          passingScore: 70,
          maxAttempts: 3,
          dueInDays: 7,
          questions: [
            { prompt: "Which protocol do browsers use to request web pages?", explanation: "HTTP (and its secure variant HTTPS) carries requests and responses.", choices: ["FTP", "HTTP", "SMTP", "SSH"], correct: 1 },
            { prompt: "Which element should wrap the primary content of a page?", explanation: "<main> marks the dominant content and is a landmark for assistive technology.", choices: ["<div>", "<section>", "<main>", "<article>"], correct: 2 },
            { prompt: "Which CSS layout system is designed for two-dimensional layouts?", explanation: "Grid controls rows and columns simultaneously.", choices: ["Flexbox", "Floats", "Grid", "Tables"], correct: 2 },
          ],
        },
      },
      {
        title: "JavaScript Essentials",
        lessons: [
          lesson("Variables, Types and Functions", "JavaScript is dynamically typed. Understanding its primitive types and functions is the foundation for everything else.", ["Prefer `const`, use `let` when reassignment is needed.", "Primitive types include string, number, boolean, null and undefined.", "Functions are values: they can be passed and returned.", "Arrow functions capture `this` from their surrounding scope."], 20),
          lesson("Working with the DOM", "The DOM API lets scripts read and change the page in response to user actions.", ["`document.querySelector` finds elements with CSS selectors.", "`addEventListener` reacts to clicks, input and more.", "Change content with `textContent` to avoid injection risks.", "Batch DOM updates to keep pages responsive."], 25, 10),
        ],
        quiz: {
          title: "JavaScript Essentials Quiz",
          description: "Check your understanding of core JavaScript concepts.",
          passingScore: 70,
          maxAttempts: null,
          dueInDays: 12,
          questions: [
            { prompt: "Which keyword declares a block-scoped variable that cannot be reassigned?", explanation: "const bindings cannot be reassigned.", choices: ["var", "let", "const", "static"], correct: 2 },
            { prompt: "Which property safely sets plain text on an element?", explanation: "textContent never parses HTML, so it cannot inject markup.", choices: ["innerHTML", "textContent", "outerHTML", "insertAdjacentHTML"], correct: 1 },
            { prompt: "Which method attaches an event handler?", explanation: "addEventListener supports multiple handlers per event.", choices: ["onEvent", "attachHandler", "addEventListener", "listen"], correct: 2 },
          ],
        },
      },
    ],
  },
  {
    slug: "intro-to-data-analysis-with-sql",
    title: "Intro to Data Analysis with SQL",
    summary: "Query, filter and summarise data with SQL, the language of relational databases.",
    description: "Learn to answer real questions with data. This course covers SELECT queries, filtering, joins and aggregation using PostgreSQL syntax.",
    objectives: ["Write SELECT queries with filters", "Join related tables", "Summarise data with GROUP BY"],
    category: "Data Science",
    status: "PUBLISHED",
    modules: [
      {
        title: "Querying Data",
        lessons: [
          lesson("SELECT and WHERE", "SQL queries describe the data you want; the database decides how to fetch it.", ["`SELECT` chooses columns.", "`WHERE` filters rows.", "`ORDER BY` sorts results.", "`LIMIT` restricts how many rows are returned."], 20),
          lesson("Joins and Aggregation", "Relational data is split across tables. Joins recombine it, and aggregates summarise it.", ["`INNER JOIN` keeps matching rows only.", "`LEFT JOIN` keeps every row from the left table.", "`GROUP BY` groups rows for aggregates like `COUNT` and `AVG`.", "`HAVING` filters groups after aggregation."], 30),
        ],
        quiz: {
          title: "SQL Basics Quiz",
          description: "Two quick questions on querying.",
          passingScore: 50,
          maxAttempts: 5,
          questions: [
            { prompt: "Which clause filters rows before grouping?", explanation: "WHERE filters rows; HAVING filters groups.", choices: ["HAVING", "WHERE", "GROUP BY", "ORDER BY"], correct: 1 },
            { prompt: "Which join keeps all rows from the left table?", explanation: "LEFT JOIN fills unmatched right-side columns with NULL.", choices: ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN"], correct: 1 },
          ],
        },
      },
    ],
  },
  {
    slug: "effective-remote-collaboration",
    title: "Effective Remote Collaboration",
    summary: "Habits and tools for productive, inclusive teamwork across time zones.",
    description: "A short, reading-based course on asynchronous communication, documentation and meeting hygiene for distributed teams.",
    objectives: ["Write clear asynchronous updates", "Run focused meetings"],
    category: "Business & Productivity",
    status: "PUBLISHED",
    modules: [
      {
        title: "Working Asynchronously",
        lessons: [
          lesson("Writing Great Updates", "Good written updates replace many meetings.", ["Lead with the decision or ask.", "Link to context instead of repeating it.", "State deadlines explicitly with time zones."], 10),
          lesson("Meetings Worth Having", "Synchronous time is expensive across time zones; use it deliberately.", ["Share an agenda in advance.", "End with owners and next steps.", "Record decisions where everyone can find them."], 10),
        ],
      },
    ],
  },
  {
    slug: "design-systems-101",
    title: "Design Systems 101",
    summary: "Build consistent interfaces with tokens, components and documentation.",
    description: "Work in progress: an introduction to design tokens, component libraries and governance.",
    objectives: ["Define design tokens", "Document components"],
    category: "Design",
    status: "DRAFT",
    modules: [{ title: "Foundations", lessons: [lesson("What Is a Design System?", "A design system is a shared language between design and engineering.", ["Tokens capture colours, spacing and type.", "Components encode reusable patterns."], 15)] }],
  },
];

async function main() {
  const roleDescriptions: Record<RoleName, string> = {
    STUDENT: "Enrolls in courses, completes lessons and takes quizzes.",
    INSTRUCTOR: "Creates and manages courses and views learner progress.",
    ADMIN: "Manages users, categories and all courses.",
  };
  const roles = {} as Record<RoleName, string>;
  for (const name of Object.keys(roleDescriptions) as RoleName[]) {
    const role = await db.role.upsert({ where: { name }, create: { name, description: roleDescriptions[name] }, update: {} });
    roles[name] = role.id;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const upsertUser = (email: string, name: string, role: RoleName) =>
    db.user.upsert({ where: { email }, create: { email, name, passwordHash, roleId: roles[role] }, update: { name, roleId: roles[role] } });
  const admin = await upsertUser("admin@classsync.dev", "Avery Admin", "ADMIN");
  const instructor = await upsertUser("instructor@classsync.dev", "Iris Instructor", "INSTRUCTOR");
  const student = await upsertUser("student@classsync.dev", "Sam Student", "STUDENT");
  const graduate = await upsertUser("graduate@classsync.dev", "Taylor Graduate", "STUDENT");

  const categoryIds: Record<string, string> = {};
  for (const name of ["Web Development", "Data Science", "Design", "Business & Productivity"]) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    categoryIds[name] = (await db.category.upsert({ where: { slug }, create: { name, slug }, update: { name } })).id;
  }

  await db.course.deleteMany({ where: { slug: { in: courses.map((c) => c.slug) } } });
  const created: Record<string, { id: string; lessons: string[]; quizzes: string[] }> = {};
  for (const c of courses) {
    const course = await db.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        description: c.description,
        objectives: c.objectives,
        status: c.status,
        publishedAt: c.status === "PUBLISHED" ? new Date(Date.now() - 30 * DAY) : null,
        minimumGrade: c.minimumGrade ?? null,
        instructorId: instructor.id,
        categoryId: categoryIds[c.category],
      },
    });
    const record = { id: course.id, lessons: [] as string[], quizzes: [] as string[] };
    for (const [mi, m] of c.modules.entries()) {
      const mod = await db.module.create({ data: { courseId: course.id, title: m.title, position: mi } });
      for (const [li, l] of m.lessons.entries()) {
        const created = await db.lesson.create({
          data: {
            moduleId: mod.id,
            title: l.title,
            content: l.content,
            objectives: l.objectives,
            estimatedMinutes: l.minutes,
            dueAt: l.dueInDays ? inDays(l.dueInDays) : null,
            position: li,
          },
        });
        record.lessons.push(created.id);
      }
      if (m.quiz) {
        const quiz = await db.quiz.create({
          data: {
            courseId: course.id,
            moduleId: mod.id,
            title: m.quiz.title,
            description: m.quiz.description,
            passingScore: m.quiz.passingScore,
            maxAttempts: m.quiz.maxAttempts,
            dueAt: m.quiz.dueInDays ? inDays(m.quiz.dueInDays) : null,
            questions: {
              create: m.quiz.questions.map((q, qi) => ({
                prompt: q.prompt,
                explanation: q.explanation,
                position: qi,
                choices: { create: q.choices.map((text, ci) => ({ text, isCorrect: ci === q.correct, position: ci })) },
              })),
            },
          },
        });
        record.quizzes.push(quiz.id);
      }
    }
    created[c.slug] = record;
  }

  // Sam: part-way through Modern Web Foundations, with one failed quiz attempt.
  const web = created["modern-web-foundations"];
  await db.enrollment.create({ data: { userId: student.id, courseId: web.id } });
  await db.lessonProgress.createMany({ data: web.lessons.slice(0, 2).map((lessonId) => ({ userId: student.id, lessonId })) });
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: web.quizzes[0] }, include: { questions: { orderBy: { position: "asc" }, include: { choices: { orderBy: { position: "asc" } } } } } });
  const answers = Object.fromEntries(quiz.questions.map((q, i) => [q.id, (i === 2 ? q.choices.find((c) => !c.isCorrect) : q.choices.find((c) => c.isCorrect))!.id]));
  const result = gradeSubmission(quiz.questions, answers, quiz.passingScore);
  await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: student.id, attemptNumber: 1, score: result.score, maxScore: result.maxScore, percentage: result.percentage, passed: result.passed, submittedAt: new Date(Date.now() - 2 * DAY), responses: { create: result.responses } },
  });
  await db.enrollment.create({ data: { userId: student.id, courseId: created["intro-to-data-analysis-with-sql"].id } });

  // Taylor: finished Effective Remote Collaboration, so completion logic issues a certificate.
  const remote = created["effective-remote-collaboration"];
  await db.enrollment.create({ data: { userId: graduate.id, courseId: remote.id } });
  await db.lessonProgress.createMany({ data: remote.lessons.map((lessonId) => ({ userId: graduate.id, lessonId })) });
  await db.$transaction((tx) => syncCompletion(tx, graduate.id, remote.id));
  await db.enrollment.create({ data: { userId: graduate.id, courseId: web.id } });

  await db.announcement.create({
    data: { courseId: web.id, authorId: instructor.id, title: "Welcome to Modern Web Foundations!", body: "Start with \"How the Web Works\" and post questions in the discussion board. The first quiz is due next week." },
  });
  const thread = await db.discussionPost.create({
    data: { courseId: web.id, authorId: student.id, title: "When should I use <section> vs <div>?", body: "I'm not sure when a section is appropriate. Any rules of thumb?" },
  });
  await db.discussionPost.create({
    data: { courseId: web.id, authorId: instructor.id, parentId: thread.id, body: "Use <section> when the content has its own heading and forms part of the document outline. Use <div> purely for styling hooks." },
  });

  console.log(`Seeded ${courses.length} courses. Demo accounts (password "${PASSWORD}"):`);
  for (const u of [admin, instructor, student, graduate]) console.log(`  ${u.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
