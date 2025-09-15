import { type AnyColumn, Column, type GetColumnData, is } from "drizzle-orm";
import { type SQL, type SQLWrapper, sql } from "drizzle-orm/sql";

// ---------------- JSON Types ----------------

type JsonColumnType =
	| ("PgJson" | "PgJsonb" | "MySqlJson" | "SingleStoreJson" | "SQLiteTextJson" | "SQLiteBlobJson")
	| (never & {});
type JsonColumn = AnyColumn & { columnType: JsonColumnType };
type JsonProperties<T extends JsonColumn> = T["_"]["data"];

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

// Partially taken from https://gist.github.com/rphlmr/0d1722a794ed5a16da0fdf6652902b15#file-utils-ts

// type SQLOrColumn<T extends SQL<T> | SQL.Aliased<T> | AnyColumn> = T extends AnyColumn ? SQL<GetColumnData<T>> : SQL<T> | SQL.Aliased<T>;
//
// type a = SQLOrColumn<typeof userAchievements.unlocked_at>;

/** Return a distinct value for a column */
export function distinct(column: SQLWrapper) {
	return sql<string>`distinct(${column})`;
}

/** Drizzle helper for multiplication */
export function multiply(left: SQLWrapper | number, right: SQLWrapper | number): SQL<number> {
	return sql`(${left} * ${right})`.mapWith(Number);
}

/** Drizzle helper for division */
export function divide(left: SQLWrapper | number, right: SQLWrapper | number): SQL<number> {
	return sql`(${left} / ${right})`.mapWith(Number);
}

/** Drizzle helper for addition */
export function add(left: SQLWrapper | number, right: SQLWrapper | number): SQL<number> {
	return sql`(${left} + ${right})`.mapWith(Number);
}

/** Drizzle helper for subtraction */
export function subtract(left: SQLWrapper | number, right: SQLWrapper | number): SQL<number> {
	return sql`(${left} - ${right})`.mapWith(Number);
}

/** Drizzle helper for concatenation */
export function concat(...values: (SQLWrapper | string | number)[]): SQL<string> {
	return sql.join(values, sql.raw(" || ")).mapWith(String);
}

/**
 * Drizzle helper to coalesce a value to a default value if the value is null
 * @example
 * coalesce(pubThemeListQuery.themes, sql<string[]>`'[]'`)
 * coalesce(PubPollAnswersQuery.updated_at, now())
 */
export function coalesce<TColumn extends Column>(column: TColumn): SQL<GetColumnData<TColumn, "query">>;
export function coalesce<TColumn extends Column>(
	column: TColumn,
	...rest: (
		| GetColumnData<TColumn, "query">
		| SQL<GetColumnData<TColumn, "query">>
		| SQL.Aliased<GetColumnData<TColumn, "query">>
		| null
	)[]
): SQL<Exclude<GetColumnData<TColumn, "query">, null>>;
export function coalesce<T>(expr: SQL<T> | SQL.Aliased<T> | T | null): SQL<T>;
export function coalesce<T>(
	expr: SQL<T> | SQL.Aliased<T> | T | null,
	...rest: (SQL<T> | SQL.Aliased<T> | T | null)[]
): SQL<Exclude<T, null>>;
export function coalesce(first: SQLWrapper | Column | unknown, ...rest: (SQLWrapper | Column | unknown)[]): SQL {
	const exprs = [first, ...rest] as SQLWrapper[];

	return sql`coalesce(${sql.join(exprs, sql.raw(", "))})`.mapWith(is(first, Column) ? first : String);
}

/**
 * Helper for referencing the "excluded" (upsert conflict) value of a column.
 * Avoids repeating raw sql`excluded.column_name` strings and centralizes any future dialect nuance.
 */
export function excluded<T>(column: AnyColumn): SQL<T> {
	// Drizzle doesn't expose a structured helper; rely on column.name which is stable in schema
	return sql<T>`excluded.${sql.raw(column.name)}`;
}

/** Helper for MAX(column/expression) */
export function max<T>(expr: AnyColumn | SQL<T>): SQL<T> {
	return sql<T>`max(${expr})`;
}

/**
 * Get the current timestamp
 * @param type - "timestamp" for seconds, "timestamp_ms" for milliseconds. This depends on what your SQLite integer column is set to.
 * @example
 * now("timestamp")
 */
export function now(type: "timestamp" | "timestamp_ms"): SQL<Date> {
	switch (type) {
		case "timestamp":
			return sql<string>`CURRENT_TIMESTAMP`.mapWith((v?: number | string) =>
				v === undefined ? new Date() : typeof v === "number" ? new Date(v * 1000) : new Date(v),
			);
		case "timestamp_ms":
			return sql`(STRFTIME('%s', 'now') * 1000)`.mapWith((v?: number | string) =>
				v === undefined ? new Date() : typeof v === "number" ? new Date(v) : new Date(Number(v)),
			);
	}
}

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

export type StringColumnLike = SQL<string> | SQL.Aliased<string> | AnyColumn<{ dataType: "string" }>;
type StringLike = string | StringColumnLike;

/**
 * Drizzle helper to uppercase a string expression
 *
 * @example
 * upper(apps.name) // column
 * upper(sql`'test'`) // raw SQL
 */
export function upper(value: StringLike): SQL<string> {
	return sql`UPPER(${value})`.mapWith(String);
}

/**
 * Drizzle helper to lowercase a string expression
 *
 * @example
 * lower(apps.name) // column
 * lower(sql`'TEST'`) // raw SQL
 */
export function lower(value: StringLike): SQL<string> {
	return sql`LOWER(${value})`.mapWith(String);
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
	return sql`${column} GLOB ${pattern}`.mapWith(Boolean);
}

type CaseWhenExpr<T> = { cond: SQL | SQLWrapper | undefined; val: SQL<T> };

// The main typed builder
class CaseBuilder<T> {
	private whens: CaseWhenExpr<T>[];
	private elseVal?: SQL<T>;

	constructor(whens: CaseWhenExpr<T>[] = [], elseVal?: SQL<T>) {
		this.whens = whens;
		this.elseVal = elseVal;
	}

	when(cond: SQL | SQLWrapper | undefined, val: SQL<T> | T | null): this {
		if (cond !== undefined) {
			this.whens.push({ cond, val: val as SQL<T> });
		}
		return this;
	}

	else(val: SQL<T> | T): this {
		this.elseVal = val as SQL<T>;
		return this;
	}

	end(): SQL<T | null> {
		const whensSql = this.whens.map(({ cond, val }) => sql`WHEN ${cond} THEN ${val}`);
		const elseSql = this.elseVal ? sql` ELSE ${this.elseVal}` : sql``;
		return sql`CASE ${sql.join(whensSql, sql.raw(" "))}${elseSql} END`;
	}

	endNonNull(): SQL<T> {
		if (this.elseVal == null) {
			throw new Error("endNonNull requires an ELSE clause");
		}
		return this.end() as SQL<T>;
	}
}

// Initial untyped stage
class CaseBuilderInit {
	when<U>(cond: SQL | SQLWrapper | undefined, val: SQL<U> | U | null): CaseBuilder<U> {
		if (cond === undefined) {
			return new CaseBuilder<U>([]);
		}
		return new CaseBuilder<U>([{ cond, val: val as SQL<U> }]);
	}
}

export function caseWhen() {
	return new CaseBuilderInit();
}
