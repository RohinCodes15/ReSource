import { spawnSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is required for the isolated integration suite.");
  process.exit(2);
}
let parsed;
try { parsed = new URL(url); } catch {
  console.error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  process.exit(2);
}
if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
  console.error("Refusing integration tests: TEST_DATABASE_URL must use the PostgreSQL protocol.");
  process.exit(2);
}
if (!parsed.username || !parsed.password || [...parsed.searchParams.keys()].some(key => key !== "schema") ||
    (parsed.searchParams.has("schema") && parsed.searchParams.get("schema") !== "public")) {
  console.error("Refusing integration tests: configure explicit local test credentials and only the optional schema=public parameter.");
  process.exit(2);
}
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/^\/[a-z0-9_-]*test[a-z0-9_-]*$/i.test(parsed.pathname)) {
  console.error("Refusing integration tests: use a local PostgreSQL database whose name contains 'test'.");
  process.exit(2);
}
if (process.env.RESOURCE_ALLOW_LOCAL_TEST_DATABASE !== "true") {
  console.error("Refusing migrations until you explicitly set RESOURCE_ALLOW_LOCAL_TEST_DATABASE=true for the isolated local test database.");
  process.exit(2);
}
if (process.env.DATABASE_URL !== url) {
  console.error("Set DATABASE_URL to the exact same isolated test URL.");
  process.exit(2);
}
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {stdio:"inherit", env:{...process.env, DATABASE_URL:url}});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const tests = spawnSync("npx", ["vitest", "run", "tests/live.integration.test.ts"], {stdio:"inherit", env:{...process.env, DATABASE_URL:url, TEST_DATABASE_URL:url}});
process.exit(tests.status ?? 1);
