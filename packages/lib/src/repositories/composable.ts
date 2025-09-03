import type { SQL } from "drizzle-orm";
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
	 * Provide a freshness cutoff (Date). Any existing row with updated_at < cutoff
	 * should be considered stale by ensureDataExists() implementations. Optional
	 * so repositories that do not rely on freshness can ignore it.
	 */
	withCutoff?(cutoff: Date): this;

	/**
	 * Build and execute the composed query, returning results with error propagation
	 */
	build(options?: ComposableQueryOptions<TSortMethod>): Promise<ComposableQueryResult<TResult>>;

	/**
	 * Execute an identical filter stack as build(), but return a COUNT only.
	 * Implementations must preserve dual-storage semantics (ensure data before counting).
	 */
	count(): Promise<Attempt<number, AttemptStatus>>;
}

/**
 * Interface for composers that can provide CTEs to define required data
 * This enables cross-repository data dependency resolution without parameter explosion
 */
export interface SubqueryProvider {
	/**
	 * Build a CTE that selects the IDs of required entities
	 * Returns a CTE that can be used by dependency repositories
	 * to determine what data needs to be fetched
	 */
	buildRequiredEntitySubquery?(entityType: string, cteName: string): SQL | undefined;
}

/**
 * Interface for composers that can accept CTEs to determine required data
 * This allows repositories to avoid parameter explosion when ensuring dependency data exists
 */
export interface SubqueryConsumer<TResult, TSortMethod extends string> extends QueryComposer<TResult, TSortMethod> {
	/**
	 * Accept a CTE that defines which entities are required
	 * This CTE will be used instead of explicit ID arrays for data existence checking
	 */
	withRequiredEntitySubquery?(entityType: string, subquery: SQL): this;

	/**
	 * Ensure required data exists based on current filter state
	 * Uses CTEs when available, falls back to explicit IDs when needed
	 */
	ensureDataExists?(): Promise<Attempt<void, AttemptStatus>>;
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
