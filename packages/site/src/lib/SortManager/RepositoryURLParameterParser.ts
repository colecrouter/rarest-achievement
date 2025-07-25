import type { Repository, SortDirection } from "@project/lib";
import type { RepositoryBasedSortConfig } from "./RepositorySortManager.svelte";

// Base constraints matching the Repository interface
type BaseFilters = Record<string, string | number | undefined>;
type BaseSortMethods = string;

// Extract types from repository classes using conditional types
type ExtractRepositorySortMethods<T> = T extends Repository<unknown, BaseFilters, infer SortMethods>
    ? SortMethods
    : never;

/**
 * Abstract base class for safely parsing URL parameters into repository-specific sort configuration.
 *
 * This class provides type-safe validation and conversion of URL search parameters back to
 * strongly-typed repository configuration objects. It leverages the existing Repository types
 * to ensure validation aligns with the expected parameter types.
 *
 * @example
 * ```typescript
 * class AchievementURLParser extends RepositoryURLParameterParser<UserAchievementRepository | AppAchievementRepository> {
 *     protected validateSortMethod(value: string): ExtractRepositorySortMethods<TRepository> | null {
 *         const validMethods = ["rarity_pct", "rarity_score", "name", "unlocked_at"] as const;
 *         return validMethods.includes(value as any) ? value as ExtractRepositorySortMethods<TRepository> : null;
 *     }
 *
 *     protected validateFilter(value: string): string | null {
 *         const validFilters = ["all", "unlocked", "locked"];
 *         return validFilters.includes(value) ? value : null;
 *     }
 * }
 *
 * const parser = new AchievementURLParser({ method: "rarity_pct", direction: "asc" });
 * const config = parser.parseFromURL(new URL(window.location.href));
 * ```
 */
export abstract class RepositoryURLParameterParser<
    TRepository extends Repository<unknown, BaseFilters, BaseSortMethods>,
> {
    protected readonly defaults: RepositoryBasedSortConfig<TRepository>;

    private readonly paramNames = {
        search: "q",
        filter: "filter",
        method: "sort",
        direction: "dir",
    } as const;

    constructor(defaults: RepositoryBasedSortConfig<TRepository>) {
        this.defaults = defaults;
    }

    /**
     * Validate and convert a string value to a valid sort method for this repository.
     * Subclasses must implement this to define which sort methods are valid.
     *
     * @param value - The raw string value from URL parameters
     * @returns The validated sort method or null if invalid
     */
    protected abstract validateSortMethod(value: string): ExtractRepositorySortMethods<TRepository> | null;

    /**
     * Validate and convert a string value to a valid filter for this repository.
     * Subclasses can override this to define repository-specific filter validation.
     * Default implementation accepts any non-empty string.
     *
     * @param value - The raw string value from URL parameters
     * @returns The validated filter or null if invalid
     */
    protected validateFilter(value: string): string | null {
        return value.trim() ? value : null;
    }

    /**
     * Validate and convert a string value to a valid search term.
     * Subclasses can override this to define repository-specific search validation.
     * Default implementation accepts any non-empty string.
     *
     * @param value - The raw string value from URL parameters
     * @returns The validated search term or null if invalid
     */
    protected validateSearch(value: string): string | null {
        return value.trim() ? value : null;
    }

    /**
     * Validate and convert a string value to a valid sort direction.
     *
     * @param value - The raw string value from URL parameters
     * @returns The validated sort direction or null if invalid
     */
    protected validateDirection(value: string): SortDirection | null {
        return value === "asc" || value === "desc" ? value : null;
    }

    /**
     * Parse URL search parameters into a strongly-typed repository configuration.
     * Falls back to defaults for any invalid or missing parameters.
     *
     * @param url - The URL to parse parameters from
     * @returns A validated repository configuration object
     */
    parseFromURL(url: URL): RepositoryBasedSortConfig<TRepository> {
        const params = url.searchParams;

        // Parse and validate each parameter, falling back to defaults
        const search = this.parseOptionalParam(
            params.get(this.paramNames.search),
            this.validateSearch.bind(this),
            this.defaults.search,
        );

        const filter = this.parseOptionalParam(
            params.get(this.paramNames.filter),
            this.validateFilter.bind(this),
            this.defaults.filter,
        );

        const method = this.parseRequiredParam(
            params.get(this.paramNames.method),
            this.validateSortMethod.bind(this),
            this.defaults.method,
        );

        const direction = this.parseRequiredParam(
            params.get(this.paramNames.direction),
            this.validateDirection.bind(this),
            this.defaults.direction,
        );

        return {
            search,
            filter,
            method,
            direction,
        };
    }

    /**
     * Convert a repository configuration back to URL search parameters.
     * Only sets parameters that differ from defaults to keep URLs clean.
     *
     * @param config - The repository configuration to convert
     * @param baseUrl - The base URL to add parameters to (optional)
     * @returns A URL string with the appropriate search parameters
     */
    buildURL(config: RepositoryBasedSortConfig<TRepository>, baseUrl?: URL): string {
        const url = baseUrl ? new URL(baseUrl) : new URL(window.location.href);
        const params = new URLSearchParams(url.searchParams);

        // Only set parameters that differ from defaults
        if (config.search && config.search !== this.defaults.search) {
            params.set(this.paramNames.search, config.search);
        } else {
            params.delete(this.paramNames.search);
        }

        if (config.filter && config.filter !== this.defaults.filter) {
            params.set(this.paramNames.filter, config.filter);
        } else {
            params.delete(this.paramNames.filter);
        }

        if (config.method !== this.defaults.method) {
            params.set(this.paramNames.method, config.method);
        } else {
            params.delete(this.paramNames.method);
        }

        if (config.direction !== this.defaults.direction) {
            params.set(this.paramNames.direction, config.direction);
        } else {
            params.delete(this.paramNames.direction);
        }

        return `${url.origin}${url.pathname}?${params.toString()}`;
    }

    /**
     * Helper to parse optional parameters with validation and fallback.
     */
    private parseOptionalParam<T>(
        value: string | null,
        validator: (value: string) => T | null,
        fallback: T | undefined,
    ): T | undefined {
        if (!value) return fallback;
        const validated = validator(value);
        return validated !== null ? validated : fallback;
    }

    /**
     * Helper to parse required parameters with validation and fallback.
     */
    private parseRequiredParam<T>(value: string | null, validator: (value: string) => T | null, fallback: T): T {
        if (!value) return fallback;
        const validated = validator(value);
        return validated !== null ? validated : fallback;
    }
}
