import { Attempt, AttemptStatus } from "../error";
import type { LanguageCode } from "../lang";

export type SortDirection = "asc" | "desc";

/**
 * Sort configuration for composable queries
 */
export interface ComposableQuerySort<Method extends string> {
    method: Method;
    direction: SortDirection;
}

/**
 * Execution options for composable queries
 */
export interface ComposableQueryOptions<Method extends string> {
    cursor?: number;
    limit?: number;
    sort?: ComposableQuerySort<Method>;
}

/**
 * Result wrapper for composable queries
 */
export class ComposableQueryResult<T> extends Attempt<T[], AttemptStatus.Partial | AttemptStatus.Ok> {
    /** Next offset to use as cursor */
    cursor: number;

    constructor(data: T[], cursor: number, error: Error | null = null) {
        super(error ? AttemptStatus.Partial : AttemptStatus.Ok, data, error);
        this.cursor = cursor;
    }
}

/**
 * Base interface for all query composers
 */
export interface QueryComposer<TResult, TSortMethod extends string> {
    /**
     * Set the language for this query
     */
    withLanguage?(lang: LanguageCode): this;

    /**
     * Build and execute the composed query, returning results with error propagation
     */
    build(options?: ComposableQueryOptions<TSortMethod>): Promise<ComposableQueryResult<TResult>>;
}

/**
 * Base interface for repositories with composable query support
 */
export interface ComposableRepository<
    TResult,
    TSortMethod extends string,
    TComposer extends QueryComposer<TResult, TSortMethod>,
> {
    /**
     * Create a new composable query builder
     */
    compose(): TComposer;
}

/**
 * Helper to create a ComposableQueryResult with proper cursor calculation
 */
export function createQueryResult<T>(
    data: T[],
    cursor: number | undefined,
    error: Error | null = null,
): ComposableQueryResult<T> {
    return new ComposableQueryResult(data, (cursor || 0) + data.length, error);
}
