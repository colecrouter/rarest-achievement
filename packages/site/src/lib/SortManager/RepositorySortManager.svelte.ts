import type { Repository, RepositorySort, SortDirection } from "@project/lib";
import type { SortManager } from "./SortManager";
import { page } from "$app/state";

// Base constraints matching the Repository interface
type BaseFilters = Record<string, string | number | undefined>;
type BaseSortMethods = string;

// Extract types from repository classes using conditional types
type ExtractRepositoryData<T> = T extends Repository<infer Data, BaseFilters, BaseSortMethods> ? Data : never;
type ExtractRepositorySortMethods<T> = T extends Repository<unknown, BaseFilters, infer SortMethods>
    ? SortMethods
    : never;

export abstract class RepositoryClientSortManager<
    TRepository extends Repository<unknown, object, string>,
    TData = ExtractRepositoryData<TRepository>,
> implements SortManager<TData>
{
    search;
    filter;
    method;
    direction;

    constructor(defaults: RepositoryBasedSortConfig<TRepository>) {
        this.search = $state<string | undefined>(defaults.search);
        this.filter = $state<string | undefined>(defaults.filter);
        this.method = $state<ExtractRepositorySortMethods<TRepository>>(defaults.method);
        this.direction = $state<SortDirection>(defaults.direction);
    }

    abstract sort(data: TData[]): TData[];
}

export abstract class RepositoryServerSortManager<
    TRepository extends Repository<unknown, BaseFilters, BaseSortMethods>,
    TData = ExtractRepositoryData<TRepository>,
> implements SortManager<TData>
{
    search;
    filter;
    method;
    direction;
    url;

    private paramNames = {
        search: "q",
        filter: "filter",
        method: "sort",
        direction: "dir",
    } as const;

    constructor(defaults: RepositorySort<ExtractRepositorySortMethods<TRepository>>) {
        this.url = $derived(page.url);
        this.search = $derived(this.url.searchParams.get(this.paramNames.search) ?? defaults.search);
        this.filter = $derived(this.url.searchParams.get(this.paramNames.filter) ?? "all");
        this.method = $derived(
            (this.url.searchParams.get(this.paramNames.method) as ExtractRepositorySortMethods<TRepository>) ??
                defaults.method,
        );
        this.direction = $derived(
            (this.url.searchParams.get(this.paramNames.direction) as SortDirection) ?? defaults.direction,
        );
    }

    generateUrl(
        overrides: Partial<{
            search: string;
            filter: string;
            method: ExtractRepositorySortMethods<TRepository>;
            direction: SortDirection;
        }>,
    ): string {
        const params = new URLSearchParams(this.url.searchParams);
        if (overrides.search !== undefined) params.set(this.paramNames.search, overrides.search);
        if (overrides.filter !== undefined) params.set(this.paramNames.filter, overrides.filter);
        if (overrides.method !== undefined) params.set(this.paramNames.method, overrides.method);
        if (overrides.direction !== undefined) params.set(this.paramNames.direction, overrides.direction);

        return `?${params.toString()}`;
    }

    abstract sort(data: TData[]): TData[];
}

// Base sort manager config that works with any repository
export interface RepositoryBasedSortConfig<
    TRepository extends Repository<unknown, BaseFilters, BaseSortMethods>,
    TSortMethods = ExtractRepositorySortMethods<TRepository>,
> {
    search?: string;
    filter?: string;
    method: TSortMethods;
    direction: SortDirection;
}
