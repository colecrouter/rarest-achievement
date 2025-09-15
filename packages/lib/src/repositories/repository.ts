import { Attempt, AttemptStatus } from "../error";
import type { APILanguageCode } from "../lang";
import type { QueryComposer } from "./composable";

export type SortDirection = "asc" | "desc";

export interface RepositorySort<Method extends string, Direction = SortDirection> {
	method: Method;
	direction: Direction;
	search?: string;
}

export class RepositoryResult<T> extends Attempt<T[], AttemptStatus.Partial | AttemptStatus.Ok> {
	/** Next offset to use as cursor */
	cursor: number;

	constructor(data: T[], cursor: number, error: Error | null = null) {
		super(error ? AttemptStatus.Partial : AttemptStatus.Ok, data, error);
		this.cursor = cursor;
	}
}

export interface Repository<Data, SortMethods extends string> {
	/**
	 * Create a new composable query builder for this repository.
	 *
	 * @param lang - Optional API language code for the query
	 * @returns A composable query builder that can be chained with filtering methods
	 */
	compose(lang?: APILanguageCode): QueryComposer<Data, SortMethods>;
}
