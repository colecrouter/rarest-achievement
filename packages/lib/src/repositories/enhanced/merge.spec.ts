import { assert, describe, it } from "vitest";
import { fetchAndUpsert, getMissingKeys1D, getMissingKeys2D } from "./merge";

describe("Missing Keys Functions", () => {
    describe("getMissingKeys1D", () => {
        it("should return missing keys for 1D map", () => {
            // Given expected keys [1,2,3] and map with 1 and 3 only
            const expected = [1, 2, 3];
            const data = new Map<number, unknown>([
                [1, "a"],
                [3, "b"],
            ]);
            const missing = getMissingKeys1D(expected, data, "1D Map Test");
            // Only key 2 is missing
            assert.deepStrictEqual(missing, [2]);
        });

        it("should return empty array when no keys are missing", () => {
            // Given expected keys [1,2] and map with both keys
            const expected = [1, 2];
            const data = new Map<number, unknown>([
                [1, "a"],
                [2, "b"],
            ]);
            const missing = getMissingKeys1D(expected, data, "1D Map Test");
            assert.deepStrictEqual(missing, []);
        });
    });

    describe("getMissingKeys2D", () => {
        it("should return missing inner pairs for 2D map", () => {
            // Given 2D map with outer keys "a" and "b" and expected inner [1,2]
            const expectedOuter = ["a", "b"];
            const expectedInner = [1, 2];
            // Create a map where:
            // "a" has only inner key 1, and "b" has only inner key 2.
            // Thus, inner 2 is missing for "a" and inner 1 is missing for "b".
            const data = new Map<string, Map<number, unknown>>();
            data.set("a", new Map<number, unknown>([[1, "val a1"]]));
            data.set("b", new Map<number, unknown>([[2, "val b2"]]));

            const missingPairs = getMissingKeys2D(expectedOuter, expectedInner, data);
            // Global missing inner keys: 1 (missing in "b") and 2 (missing in "a").
            // Therefore, expected pairs for each outer key.
            const expectedPairs = [
                ["a", 1],
                ["a", 2],
                ["b", 1],
                ["b", 2],
            ];
            assert.deepStrictEqual(missingPairs, expectedPairs);
        });

        it("should return empty array when no pairs are missing", () => {
            // Both outer keys have all expected inner keys.
            const expectedOuter = ["a", "b"];
            const expectedInner = [1, 2];
            const data = new Map<string, Map<number, unknown>>();
            data.set(
                "a",
                new Map<number, unknown>([
                    [1, "val a1"],
                    [2, "val a2"],
                ]),
            );
            data.set(
                "b",
                new Map<number, unknown>([
                    [1, "val b1"],
                    [2, "val b2"],
                ]),
            );

            const missingPairs = getMissingKeys2D(expectedOuter, expectedInner, data);
            assert.deepStrictEqual(missingPairs, []);
        });
    });
});

describe("fetchAndUpsert", () => {
    describe("1D Map", () => {
        it("should call callbacks with missing ids and merge data", async () => {
            // Tracking variables
            let getFromDBCalled = false;
            let fetchFromAPICalledArgs: unknown[] = [];
            let upsertCalledArgs: unknown[] = [];

            // Simulate getFromDB returning map missing keys 3 and 4.
            const getFromDB = async (keys: number[], lang?: string) => {
                getFromDBCalled = true;
                // Provided DB contains keys 1 and 2 only.
                return new Map<number, string>([
                    [1, "one"],
                    [2, "two"],
                ]);
            };
            // Simulate fetchFromAPI callback
            const fetchFromAPI = async (keys: number[], lang?: string) => {
                fetchFromAPICalledArgs.push(keys);
                // Return data for missing keys [3, 4]
                return {
                    data: new Map<number, string>([
                        [3, "three"],
                        [4, "four"],
                    ]),
                    error: null,
                };
            };
            // Simulate upsertDB callback
            const upsertDB = async (data: Map<number, string>) => {
                upsertCalledArgs.push(Array.from(data.keys()));
            };

            // For 1D, TArgs = [number[], string?]
            const args: [number[], string?] = [[1, 2, 3, 4], undefined];
            const result = await fetchAndUpsert(args, getFromDB, upsertDB, fetchFromAPI);

            const finalData = result.data as Map<number, string>;
            // Expect merged map: original keys 1,2 and fetched keys 3,4.
            assert.deepStrictEqual(Array.from(finalData.entries()), [
                [1, "one"],
                [2, "two"],
                [3, "three"],
                [4, "four"],
            ]);
            // Verify callbacks were called correctly.
            assert.ok(getFromDBCalled);
            assert.deepStrictEqual(fetchFromAPICalledArgs, [[3, 4]]);
            assert.deepStrictEqual(upsertCalledArgs, [[3, 4]]);
        });
    });

    describe("2D Map", () => {
        it("should call callbacks with missing outer and inner ids and merge data", async () => {
            let getFromDBCalled = false;
            let fetchFromAPICalledArgs: unknown[] = [];
            let upsertCalledArgs: unknown[] = [];

            // Simulate empty DB map to force API fetch.
            const getFromDB = async (outers: string[], inners: number[], lang?: string) => {
                getFromDBCalled = true;
                return new Map<string, Map<number, string>>();
            };
            // Simulate API fetching complete data for given outers and inners.
            const fetchFromAPI = async (outers: string[], inners: number[], lang?: string) => {
                fetchFromAPICalledArgs.push({ outers, inners });
                const newData = new Map<string, Map<number, string>>();
                for (const outer of outers) {
                    newData.set(outer, new Map(inners.map((inner) => [inner, `${outer}${inner}`])));
                }
                return { data: newData, error: null };
            };
            // Simulate upsertDB capturing merged data.
            const upsertDB = async (data: Map<string, Map<number, string>>) => {
                upsertCalledArgs.push(Array.from(data.entries()).map(([o, im]) => [o, Array.from(im.entries())]));
            };

            // For 2D, TArgs = [string[], number[], string?]
            const args: [string[], number[], string?] = [["a", "b"], [1, 2], undefined];
            const result = await fetchAndUpsert(args, getFromDB, upsertDB, fetchFromAPI);

            const finalData = result.data as Map<string, Map<number, string>>;
            // Expect merged map: for each outer, inner map with entries e.g., "a": {1:"a1",2:"a2"}
            const merged = Array.from(finalData.entries()).map(([o, im]) => [o, Array.from(im.entries())]);
            assert.deepStrictEqual(merged, [
                [
                    "a",
                    [
                        [1, "a1"],
                        [2, "a2"],
                    ],
                ],
                [
                    "b",
                    [
                        [1, "b1"],
                        [2, "b2"],
                    ],
                ],
            ]);
            // Verify callbacks were called correctly.
            assert.ok(getFromDBCalled);
            assert.deepStrictEqual(fetchFromAPICalledArgs, [{ outers: ["a", "b"], inners: [1, 2] }]);
            assert.deepStrictEqual(upsertCalledArgs, [
                [
                    [
                        "a",
                        [
                            [1, "a1"],
                            [2, "a2"],
                        ],
                    ],
                    [
                        "b",
                        [
                            [1, "b1"],
                            [2, "b2"],
                        ],
                    ],
                ],
            ]);
        });
    });
});
