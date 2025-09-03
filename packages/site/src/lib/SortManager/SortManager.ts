import type { SortDirection } from "@project/lib";

export interface SortManager<T> {
	search?: string;
	filter?: string;
	method?: string;
	direction?: SortDirection;
	sort?(data: T[]): T[];
	generateUrl?(overides?: Record<string, string>): string;
}
