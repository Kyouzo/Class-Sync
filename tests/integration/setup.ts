import { afterAll, beforeEach } from "vitest";
import { db, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.$disconnect();
});
