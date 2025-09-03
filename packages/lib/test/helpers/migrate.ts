import fs from "node:fs";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";

// __dirname is not defined in ESM; emulate it
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

/**
 * Execute all SQL migration files against an in-memory Better-SQLite3 database.
 * Looks for .sql files in ./packages/lib/drizzle and applies them in lexical order.
 *
 * Usage in a spec:
 *   const sqlite = new Database(":memory:");
 *   await runMigrations(sqlite);
 *   const db = drizzle(sqlite) as ProjectDB;
 */
export async function runMigrations(sqlite: BetterSqlite3.Database): Promise<void> {
	// Resolve relative to this file so it works regardless of CWD used by the test runner
	const migrationsDir = path.resolve(__dirname, "../../drizzle");
	const stat = fs.statSync(migrationsDir);
	if (!stat.isDirectory()) throw new Error(`Migrations directory not found: ${migrationsDir}`);

	// Read all .sql files (skip meta/)
	const entries = fs
		.readdirSync(migrationsDir, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
		.map((e) => e.name)
		.sort();

	for (const file of entries) {
		const full = path.join(migrationsDir, file);
		const sql = fs.readFileSync(full, "utf8");
		// Execute as a single batch; better-sqlite3 exec supports multiple statements
		sqlite.exec(sql);
	}
}
