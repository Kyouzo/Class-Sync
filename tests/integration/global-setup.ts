import { execSync } from "node:child_process";

/** Applies migrations to the disposable test database before any integration test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Integration tests need TEST_DATABASE_URL pointing at a disposable PostgreSQL database (it is truncated between tests).",
    );
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
