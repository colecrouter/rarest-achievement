// This helper type recursively builds nested maps from an array tuple.
type NestedMap<T extends unknown[]> = T extends [infer Head, ...infer Tail]
    ? Head extends Array<infer U>
        ? Map<U, Tail extends [] ? unknown : NestedMap<Tail>>
        : unknown
    : unknown;

/**
 * For a 1D map, return the keys that are missing.
 * @param expectedKeys - Array of the expected keys.
 * @param data - The Map from the DB.
 * @returns An array of missing keys.
 */
function getMissingKeys1D<T>(expectedKeys: T[], data: Map<T, unknown>): T[] {
    return expectedKeys.filter((key) => !data.has(key));
}

/**
 * For a 2D map, return which outer keys are missing entirely and,
 * for the ones present, which inner keys are missing.
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
    const missingOuter = expectedOuter.filter((key) => !data.has(key));
    const missingInner = new Map<TOuter, TInner[]>();

    // For each outer key that exists, check the inner keys.
    for (const outer of expectedOuter) {
        if (data.has(outer)) {
            const innerMap = data.get(outer);
            if (!innerMap) continue; // Skip if inner map is not found
            const missing = expectedInner.filter((inner) => !innerMap.has(inner));
            if (missing.length > 0) {
                missingInner.set(outer, missing);
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
    fetchFromAPI: (...args: TArgs) => Promise<TResult>,
): Promise<TResult> {
    // Attempt to get data from the DB (or cache)
    let data = await getFromDB(...args);

    // Check if the first argument is an array.
    // If it's not, we assume it's not meant for map-logic.
    if (Array.isArray(args[0]) && data instanceof Map) {
        // We have expected keys for a 1D map.
        const expectedOuter = args[0] as unknown[];

        // Check whether we have nested key information (2D map)
        if (
            args.length > 1 &&
            Array.isArray(args[1]) &&
            // A simple guard: if data values are also a Map, assume it's nested.
            [...data.values()].every((v) => v instanceof Map)
        ) {
            // 2D map case
            const expectedInner = args[1] as unknown[];
            const data2D = data as Map<unknown, Map<unknown, unknown>>;
            const { missingOuter, missingInner } = getMissingKeys2D(expectedOuter, expectedInner, data2D);

            if (missingOuter.length > 0 || missingInner.size > 0) {
                console.debug("Missing 2D data detected:", {
                    missingOuter,
                    missingInner,
                });
                const fetchedData = await fetchFromAPI(...args);
                await upsertDB(fetchedData);
                data = fetchedData;
            }
        } else {
            // 1D map case.
            const missing = getMissingKeys1D(expectedOuter, data as Map<unknown, unknown>);
            if (missing.length > 0) {
                console.debug("Missing 1D data detected:", missing);
                const fetchedData = await fetchFromAPI(...args);
                await upsertDB(fetchedData);
                data = fetchedData;
            }
        }
    } else {
        // The expected key arrays were not provided.
        // In such cases, you can either do a simple truthy check or skip.
        if (!data) {
            console.debug("Data is missing entirely.");
            const fetchedData = await fetchFromAPI(...args);
            await upsertDB(fetchedData);
            data = fetchedData;
        }
    }

    return data;
}
