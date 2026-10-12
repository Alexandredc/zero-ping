import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./.data/pglite" },
})
