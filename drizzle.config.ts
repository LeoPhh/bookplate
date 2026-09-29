import { defineConfig } from "drizzle-kit";

// `npm run db:generate` turns schema changes into a new SQL migration in
// drizzle/. Migrations are applied automatically when the server starts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
