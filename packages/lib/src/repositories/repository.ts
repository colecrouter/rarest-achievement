import { Attempt, AttemptStatus } from "../error";
import type { APILanguageCode, LanguageCode } from "../lang";
import type { QueryComposer } from "./composable";

export type SortDirection = "asc" | "desc";

export interface RepositorySort<Method extends string, Direction = SortDirection> {
	method: Method;
	direction: Direction;
	search?: string;
}

export interface RepositoryParams<
	Filters extends { [Key in keyof Filters]?: string | number },
	SortMethod extends string,
> {
	filters: {
		/* Fish out undefined, so it doesn't become (string | undefined)[] */
		[Key in keyof Filters]: NonNullable<Filters[Key]>[];
	};
	sort: RepositorySort<SortMethod>;
	/** Number offset for pagination; null for first page */
	cursor?: number;
	limit?: number;
	search?: string;
	lang: LanguageCode;
}

export class RepositoryResult<T> extends Attempt<T[], AttemptStatus.Partial | AttemptStatus.Ok> {
	/** Next offset to use as cursor */
	cursor: number;

	constructor(data: T[], cursor: number, error: Error | null = null) {
		super(error ? AttemptStatus.Partial : AttemptStatus.Ok, data, error);
		this.cursor = cursor;
	}
}

export interface Repository<
	Data,
	Filters extends { [Key in keyof Filters]?: string | number },
	SortMethods extends string,
> {
	/**
	 * Create a new composable query builder for this repository.
	 *
	 * @param lang - Optional API language code for the query
	 * @returns A composable query builder that can be chained with filtering methods
	 */
	compose(lang?: APILanguageCode): QueryComposer<Data, SortMethods>;
}
