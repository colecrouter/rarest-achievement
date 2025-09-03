import { type AnyColumn, type AnyTable, and, getTableColumns, getTableName, type InferSelectModel } from "drizzle-orm";
import { like, type Query, type SQL, sql } from "drizzle-orm/sql";
import type { SQLiteInsert, SQLiteInsertBase, SQLiteTable, TableConfig } from "drizzle-orm/sqlite-core";
import type { ProjectDB } from "../..";

const SQL_PARAM_LIMIT = 100; // Maximum number of parameters a single SQLite query can handle

// Global DB builder burst size. Default 5 to keep bursts small and memory profile consistent across all insert paths.
// Global DB builder burst size. Hardcoded to 5 to keep bursts small and memory profile consistent across all insert paths.
const FETCH_LIMIT = 5;

/**
 * Split an array into chunks of at most `size` items.
 * @param size - Maximum size of each chunk (default is SQL_PARAM_LIMIT)
 */
export function chunkArray<T>(arr: T[], size: number = SQL_PARAM_LIMIT): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

/**
 * Chunk items by parameter limit using builder measurement.
 */
function chunkByLimit<T>(items: T[], build: (chunk: T[]) => { toSQL: () => Query }): T[][] {
	const result: T[][] = [];
	let current: T[] = [];
	for (const item of items) {
		// Check if adding this item would exceed the limit
		if (current.length > 0 && build([...current, item]).toSQL().params.length > SQL_PARAM_LIMIT) {
			result.push([...current]);
			current = [];
		}
		current.push(item);
	}
	if (current.length > 0) result.push(current);
	return result;
}

/**
 * Safely chunk insert‐builders into batches that respect SQLite's parameter limit.
 *
 * @param db      Drizzle D1 database
 * @param values  array of input items to chunk
 * @param build   a function that, given a chunk of input items, returns a SQLiteInsert builder
 */
export async function safeInsert<T extends SQLiteTable, Input>(
	db: ProjectDB,
	values: Input[],
	build: (chunk: Input[]) => SQLiteInsertBase<T, "async", object>,
) {
	// Handle empty arrays - no SQL statements to execute
	if (values.length === 0) {
		return [];
	}

	const chunks = chunkByLimit(values, build);
	const builders = chunks.map((c) => build(c));

	if (builders.some((b) => b.toSQL().params.length > SQL_PARAM_LIMIT))
		throw new Error("Chunked insert exceeds SQLite parameter limit");

	// Break builders into smaller chunks to avoid overwhelming dev environment
	const builderChunks = chunkArray(builders, FETCH_LIMIT);

	const allResults: unknown[] = [];

	const hasBatch = typeof (db as unknown as { batch?: unknown }).batch === "function";

	for (const builderChunk of builderChunks) {
		if (hasBatch) {
			// Use D1/driver-provided batch when available
			const results = await (
				db as unknown as {
					batch: (
						statements: [SQLiteInsert<T, "async">, ...SQLiteInsert<T, "async">[]],
					) => Promise<unknown[]>;
				}
			).batch(builderChunk as unknown as [SQLiteInsert<T, "async">, ...SQLiteInsert<T, "async">[]]);
			allResults.push(...results);
		} else {
			// Fallback: execute each insert sequentially for environments like better-sqlite3
			for (const stmt of builderChunk) {
				// Each builder is an insert query; execute it via its run method
				// eslint-disable-next-line no-await-in-loop
				const res = await (stmt as unknown as { run: () => Promise<unknown> }).run();
				allResults.push(res);
			}
		}
	}

	return allResults as unknown[];
}

// https://github.com/drizzle-team/drizzle-orm/issues/555
export function getTableAliasedColumns<T extends AnyTable<TableConfig>>(table: T) {
	type DataType = InferSelectModel<T>;
	const tableName = getTableName(table);
	const columns = getTableColumns(table);
	return Object.entries(columns).reduce(
		(acc, [columnName, column]) => {
			(acc as Record<string, unknown>)[columnName] = sql`${column}`.as(`${tableName}_${columnName}`);
			return acc;
		},
		{} as {
			[P in keyof DataType]: SQL.Aliased<DataType[P]>;
		},
	);
}

// Partially taken from https://gist.github.com/rphlmr/0d1722a794ed5a16da0fdf6652902b15#file-utils-ts

/** Return a distinct value for a column */
export function distinct<Column extends AnyColumn>(column: Column) {
	return sql<Column["_"]["data"]>`distinct(${column})`;
}

/**
 * Drizzle helper to coalesce a value to a default value if the value is null
 * @example
 * coalesce(pubThemeListQuery.themes, sql`'[]'`)
 * coalesce(PubPollAnswersQuery.count, sql`0`)
 */
export function coalesce<T>(value: SQL.Aliased<T> | SQL<T>, defaultValue: SQL) {
	return sql<T>`coalesce(${value}, ${defaultValue})`;
}

/**
 * Helper for referencing the "excluded" (upsert conflict) value of a column.
 * Avoids repeating raw sql`excluded.column_name` strings and centralizes any future dialect nuance.
 */
export function excluded<T>(column: AnyColumn): SQL<T> {
	// Drizzle doesn't expose a structured helper; rely on column.name which is stable in schema
	return sql<T>`excluded.${sql.raw(column.name)}`;
}

/** Helper for COUNT(DISTINCT column/expression) */
export function countDistinct<T>(expr: AnyColumn | SQL<T>): SQL<number> {
	return sql<number>`count(distinct ${expr})`;
}

/** Helper for MAX(column/expression) */
export function max<T>(expr: AnyColumn | SQL<T>): SQL<T> {
	return sql<T>`max(${expr})`;
}

type Unit = "minutes" | "minute";
type Operator = "+" | "-";

/**
 * Get the current timestamp
 * @example
 * now()
 * now("+ interval 1 minute")
 */
export function now(interval?: `${Operator} interval ${number} ${Unit}`) {
	return sql<string>`now() ${interval || ""}`;
}

// ---------------- JSON Types ----------------

type JsonColumnType =
	| ("PgJson" | "PgJsonb" | "MySqlJson" | "SingleStoreJson" | "SQLiteTextJson" | "SQLiteBlobJson")
	| (never & {});
type JsonColumn = AnyColumn & { columnType: JsonColumnType };
type JsonProperties<T extends JsonColumn> = T["_"]["data"];

/**
 * Recursively build all valid paths into a JSON type
 */
// (Removed old recursive Paths helper now that we use explicit overloads for IntelliSense narrowing.)

/**
 * Walk JSON type with string | number path
 */
// (Removed old PathValue helper; overload signatures cover depth-specific typing.)

// Extract array element type
type JsonArrayElement<T> = T extends readonly (infer U)[] ? U : never;

// Ensure column is an array
type ArrayJsonColumn = JsonColumn & {
	_?: { data: readonly unknown[] };
};

type JsonProps<Col extends JsonColumn> = JsonProperties<Col>;
type KeyOfJson<T> = T extends readonly unknown[] ? number : keyof T; // number index when array else property keys
type ValueAt<T, K> = T extends readonly unknown[]
	? K extends number
		? T[number]
		: never
	: K extends keyof T
		? T[K]
		: never;

// 2 levels is probably fine
export function jsonExtract<Col extends JsonColumn>(column: Col): SQL<JsonProps<Col>>;
export function jsonExtract<Col extends JsonColumn, K1 extends KeyOfJson<JsonProps<Col>>>(
	column: Col,
	k1: K1,
): SQL<ValueAt<JsonProps<Col>, K1>>;
export function jsonExtract<
	Col extends JsonColumn,
	K1 extends KeyOfJson<JsonProps<Col>>,
	K2 extends KeyOfJson<ValueAt<JsonProps<Col>, K1>>,
>(column: Col, k1: K1, k2: K2): SQL<ValueAt<ValueAt<JsonProps<Col>, K1>, K2>>;

/**
 * Drizzle helper to extract a nested JSON value with type-safe pathing.
 *
 * @example
 * jsonExtract(apps.data, "title") // string
 * jsonExtract(apps.data, "meta", "version") // number
 * jsonExtract(apps.data, "tags", 0) // string (array element)
 */
export function jsonExtract(column: JsonColumn, ...path: (string | number)[]): SQL<unknown> {
	const columnType = column.columnType as JsonColumnType;

	switch (columnType) {
		case "SQLiteTextJson":
		case "SQLiteBlobJson": {
			const sqlitePath = `$.${path.map((p) => (typeof p === "number" ? `[${p}]` : p)).join(".")}`;
			return sql`json_extract(${column}, ${sqlitePath})`;
		}
		case "PgJson":
		case "PgJsonb": {
			const pgPath = `{${path.join(",")}}`;
			return sql`${column}#>>${pgPath}`;
		}
		case "MySqlJson":
		case "SingleStoreJson": {
			const mysqlPath = `$.${path.map((p) => (typeof p === "number" ? `[${p}]` : p)).join(".")}`;
			return sql`JSON_EXTRACT(${column}, ${mysqlPath})`;
		}
		default:
			throw new Error(`jsonExtract not supported for dialect: ${columnType}`);
	}
}

/**
 * Drizzle helper to expand a JSON array into rows.
 *
 * @example
 * db.select().from(jsonArrayEach(apps.tags)) // element type inferred
 */
export function jsonArrayEach<Col extends ArrayJsonColumn>(column: Col): SQL<JsonArrayElement<JsonProperties<Col>>> {
	const columnType = column.columnType as JsonColumnType;

	switch (columnType) {
		case "SQLiteTextJson":
		case "SQLiteBlobJson":
			return sql`json_each(${column})`;
		case "PgJson":
		case "PgJsonb":
			return sql`json_array_elements(${column})`;
		case "MySqlJson":
		case "SingleStoreJson":
			return sql`JSON_TABLE(${column}, '$[*]' COLUMNS (value JSON PATH '$'))`;
		default:
			throw new Error(`jsonArrayEach not supported for dialect: ${columnType}`);
	}
}

type StringColumnLike = SQL<string> | SQL.Aliased<string> | AnyColumn<{ dataType: "string" }>;
type StringLike = string | StringColumnLike;

/**
 * Drizzle helper to uppercase a string expression
 *
 * @example
 * upper(apps.name) // column
 * upper(sql`'test'`) // raw SQL
 */
export function upper(value: StringLike): SQL<string> {
	return sql`UPPER(${value})`;
}

/**
 * Drizzle helper to lowercase a string expression
 *
 * @example
 * lower(apps.name) // column
 * lower(sql`'TEST'`) // raw SQL
 */
export function lower(value: StringLike): SQL<string> {
	return sql`LOWER(${value})`;
}

/**
 * Drizzle helper for SQL GLOB operator
 *
 * `*` - matches any sequence of zero or more characters
 *
 * `?` - matches any single character
 *
 * @param column     Column or SQL expression to match against
 * @param pattern    Pattern to match, may include `*` and `?` wildcards
 */
export function glob(column: StringColumnLike, pattern: string): SQL<boolean> {
	return sql`${column} GLOB ${pattern}`;
}

/**
 * Search a text column for multiple terms, ensuring all terms are present (AND).
 * Terms are split on whitespace, limited to 5 terms, and special characters are escaped.
 */
export function searchTerms(column: StringColumnLike, search: string): SQL {
	// Split search into terms, remove empty ones, and escape special characters
	const terms = search
		.toLowerCase()
		.replace(/[^a-z0-9\s%_]/g, " ") // Replace non-alphanumeric characters with space
		.trim()
		.split(/\s+/)
		.filter((term) => term.trim() !== "")
		.slice(0, 5) // Limit to maximum number of terms
		.map((term) => term.replace(/[%_]/g, "\\$&")); // Escape % and _ for SQLite LIKE

	if (terms.length === 0) return sql`1=1`; // Always true, no filtering

	// Build the SQL condition for each term
	const conditions = terms.map((term) => like(lower(column), `%${term}%`));
	return and(...conditions) ?? sql`1=1`; // All terms must match
}
