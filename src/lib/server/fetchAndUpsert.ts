export type Errable<T> = Promise<[T, Error | null]>;

// This helper type recursively builds nested maps from an array tuple.
type NestedMap<T extends unknown[]> = T extends [infer Head, ...infer Tail]
    ? Head extends Array<infer U>
        ? Map<U, Tail extends [] ? unknown : NestedMap<Tail>>
        : unknown
    : unknown;

// Add debug to compare expected keys and map keys
function debugCompareKeys<T>(expectedKeys: T[], map: Map<T, unknown>, label: string): void {
    const missingKeys = expectedKeys.filter((key) => !map.has(key));
    // console.debug(`${label} - Missing keys:`, missingKeys);
}

/**
 * For a 1D map, return the keys that are missing.
 * Uses the new 2024 Set methods.
 *
 * @param expectedKeys - Array of the expected keys.
 * @param data - The Map from the DB.
 * @param debugLabel - An optional label for debugging.
 * @returns An array of missing keys.
 */
function getMissingKeys1D<T>(expectedKeys: T[], data: Map<T, unknown>, debugLabel = "1D Map"): T[] {
    debugCompareKeys(expectedKeys, data, debugLabel);
    const expectedSet = new Set(expectedKeys);
    const dataKeysSet = new Set(data.keys());
    return Array.from(expectedSet.difference(dataKeysSet));
}

/**
 * For a 2D map, return which outer keys are missing entirely and,
 * for those present, which inner keys are missing.
 * Reuses getMissingKeys1D for both the outer and inner comparisons.
 *
 * @param expectedOuter - Array of expected outer keys.
 * @param expectedInner - Array of expected inner keys.
 * @param data - The 2D Map (Map<TOuter, Map<TInner, unknown>>).
 * @returns An object with missing outer keys and a map of missing inner keys.
 */
function getMissingKeys2D<TOuter, TInner>(
    expectedOuter: TOuter[],
    expectedInner: TInner[],
    data: Map<TOuter, Map<TInner, unknown>>,
): { missingOuter: TOuter[]; missingInner: Map<TOuter, TInner[]> } {
    // Get missing outer keys using getMissingKeys1D.
    const missingOuter = getMissingKeys1D(expectedOuter, data, "2D Map Outer");
    const missingInner = new Map<TOuter, TInner[]>();

    // For each expected outer key that actually exists,
    // check its inner map for missing inner keys.
    for (const outer of expectedOuter) {
        if (data.has(outer)) {
            const innerMap = data.get(outer);
            if (!innerMap) continue; // Defensive check.
            const innerMissing = getMissingKeys1D(expectedInner, innerMap, `2D Map Inner for Outer Key: ${outer}`);
            if (innerMissing.length > 0) {
                missingInner.set(outer, innerMissing);
            }
        }
    }

    return { missingOuter, missingInner };
}

/**
 * Generic function to fetch and upsert data.
 *
 * If TArgs[0] (or TArgs[1] for a 2D map) is an array, they will be
 * interpreted as the list of expected keys for the cache. If TArgs contains
 * other types (e.g., configurations, filters) they will be ignored in the
 * missing-data logic.
 *
 * @param args - The arguments required for fetching data.
 *               If the first element is an array, it's considered as the keys
 *               for a Map. If the second element is an array, it's used for 2D
 *               maps.
 * @param getFromDB  - Function to retrieve data from the DB/cache.
 * @param upsertDB   - Function to upsert new data into the DB/cache.
 * @param fetchFromAPI - Function to fetch missing data from the API.
 * @returns The complete data, with missing pieces fetched and upserted.
 */
export async function fetchAndUpsert<
    TArgs extends unknown[],
    TResult extends TArgs[0] extends Array<unknown> ? NestedMap<TArgs> : unknown,
>(
    args: [...TArgs],
    getFromDB: (...args: TArgs) => Promise<TResult>,
    upsertDB: (data: TResult) => Promise<void>,
    fetchFromAPI: (...args: TArgs) => Errable<TResult>,
): Promise<TResult> {
    // Attempt to get data from the DB (or cache)
    let data = await getFromDB(...args);

    // Helper that performs the API fetch and DB upsert.
    // errorContext is used to customize error logging.
    async function upsertMissingData(errorContext: string): Promise<TResult> {
        const [data, err] = await fetchFromAPI(...args);
        await upsertDB(data);

        if (err) {
            console.error(`Error fetching ${errorContext} data:`, err);
        }
        return data;
    }

    // If the expected keys are passed (as first argument) and the data is a Map,
    // then check for missing keys.
    if (Array.isArray(args[0]) && data instanceof Map) {
        const expectedOuter = args[0] as unknown[];
        let missingData = false;

        // 2D map case: Check if the second argument is an array and all values in
        // the Map are also Maps.
        if (args.length > 1 && Array.isArray(args[1]) && [...data.values()].every((v) => v instanceof Map)) {
            const expectedInner = args[1] as unknown[];
            const { missingOuter, missingInner } = getMissingKeys2D(
                expectedOuter,
                expectedInner,
                data as Map<unknown, Map<unknown, unknown>>,
            );
            missingData = missingOuter.length > 0 || missingInner.size > 0;
            if (missingData) {
                data = await upsertMissingData("2D");
            }
        } else {
            // 1D map case.
            missingData = getMissingKeys1D(expectedOuter, data as Map<unknown, unknown>).length > 0;
            if (missingData) {
                data = await upsertMissingData("1D");
            }
        }
    } else if (!data) {
        // For non-Map data, simply check if there is data—if not, upsert.
        data = await upsertMissingData("non-map");
    }

    return data;
}
