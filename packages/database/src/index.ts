import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

// Lazy initialization - só conecta quando realmente usado
let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export { createDb };
export * from "./schema";
export { eq, and, or, desc, asc, sql, count, sum, inArray, gte, lte, like, ilike, isNull, isNotNull, not, ne } from "drizzle-orm";
