-- Roles are fixed reference data: create them with the schema so registration works on a fresh
-- database without running the development seed. Re-running is harmless.
INSERT INTO "Role" ("id", "name", "description") VALUES
  ('role_student', 'STUDENT', 'Enrolls in courses, completes lessons and takes quizzes.'),
  ('role_instructor', 'INSTRUCTOR', 'Creates and manages courses and views learner progress.'),
  ('role_admin', 'ADMIN', 'Manages users, categories and all courses.')
ON CONFLICT ("name") DO NOTHING;
