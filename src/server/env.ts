/** Loads `.env` into process.env for server code; variables already set win. */
try {
  process.loadEnvFile(".env")
} catch {
  // No .env file: the environment and the `gh` CLI are used as they are.
}
