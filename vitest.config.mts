import path from "path";
import { defineConfig } from "vitest/config";

// Two suites:
//   unit — pure logic, no database or server (`npm test`)
//   api  — HTTP tests against a real production build and Postgres
//          (`npm run test:api`; needs `npm run build` and `npm run db:up`)
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["test/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "api",
          include: ["test/api/**/*.test.ts"],
          environment: "node",
          globalSetup: ["test/api/setup.ts"],
          testTimeout: 20_000,
          hookTimeout: 60_000,
          // One server, one database: run the files one after another.
          fileParallelism: false,
        },
      },
    ],
  },
});
