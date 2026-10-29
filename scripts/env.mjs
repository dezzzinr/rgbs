import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
// CLI tools deliberately use the direct Neon connection when supplied.
if (process.env.DIRECT_DATABASE_URL?.trim())
  process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
