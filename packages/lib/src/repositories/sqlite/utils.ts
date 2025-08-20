import { type AnyTable, type Column, type InferSelectModel, and, getTableColumns, getTableName } from "drizzle-orm";
import { type Query, type SQL, sql } from "drizzle-orm/sql";
import type { SQLiteInsert, SQLiteInsertBase, SQLiteTable, TableConfig } from "drizzle-orm/sqlite-core";
import type { ProjectDB } from "../..";

const SQL_PARAM_LIMIT = 100; // Maximum number of parameters a single SQLite query can handle

const FETCH_LIMIT = 10;

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

export function searchTerms(column: Column | SQL, search: string): SQL {
    // Split search into terms, remove empty ones, and escape special characters
    const terms = search
        .toLowerCase()
        .replace(/[^a-z0-9\s%_]/g, " ") // Replace non-alphanumeric characters with space
        .trim()
        .split(/\s+/)
        .filter((term) => term.trim() !== "")
        .slice(0, 5) // Limit to maximum number of terms
        .map((term) => term.replace(/[%_]/g, "\\$&")); // Escape % and _ for SQLite LIKE

    if (terms.length === 0) {
        return sql`1=1`; // Always true, no filtering
    }

    // Build the SQL condition for each term
    const conditions = terms.map((term) => sql`LOWER(${column}) LIKE '%' || ${term} || '%'`);
    return and(...conditions) ?? sql`1=1`; // All terms must match
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
