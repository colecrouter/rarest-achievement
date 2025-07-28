import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Attempt, AttemptStatus } from "./error.js";

describe("Attempt", () => {
    describe("Static Factory Methods", () => {
        describe("ok", () => {
            it("should create a successful Attempt with data", () => {
                const data = "test data";
                const attempt = Attempt.ok(data);

                assert.strictEqual(attempt.status, AttemptStatus.Ok);
                assert.strictEqual(attempt.data, data);
                assert.strictEqual(attempt.error, null);
            });

            it("should work with complex data types", () => {
                const data = { key: "value", nested: { array: [1, 2, 3] } };
                const attempt = Attempt.ok(data);

                assert.strictEqual(attempt.status, AttemptStatus.Ok);
                assert.deepStrictEqual(attempt.data, data);
                assert.strictEqual(attempt.error, null);
            });

            it("should work with null data", () => {
                const attempt = Attempt.ok(null);

                assert.strictEqual(attempt.status, AttemptStatus.Ok);
                assert.strictEqual(attempt.data, null);
                assert.strictEqual(attempt.error, null);
            });
        });

        describe("partial", () => {
            it("should create a partial Attempt with data and error", () => {
                const data = "partial data";
                const error = new Error("Something went wrong");
                const attempt = Attempt.partial(data, error);

                assert.strictEqual(attempt.status, AttemptStatus.Partial);
                assert.strictEqual(attempt.data, data);
                assert.strictEqual(attempt.error, error);
            });

            it("should work with empty data", () => {
                const data: string[] = [];
                const error = new Error("Partial failure");
                const attempt = Attempt.partial(data, error);

                assert.strictEqual(attempt.status, AttemptStatus.Partial);
                assert.deepStrictEqual(attempt.data, data);
                assert.strictEqual(attempt.error, error);
            });
        });

        describe("fail", () => {
            it("should create a failed Attempt with error", () => {
                const error = new Error("Complete failure");
                const attempt = Attempt.fail(error);

                assert.strictEqual(attempt.status, AttemptStatus.Failure);
                assert.strictEqual(attempt.data, null);
                assert.strictEqual(attempt.error, error);
            });

            it("should work with custom error types", () => {
                class CustomError extends Error {
                    constructor(
                        message: string,
                        public code: number,
                    ) {
                        super(message);
                        this.name = "CustomError";
                    }
                }

                const error = new CustomError("Custom failure", 404);
                const attempt = Attempt.fail(error);

                assert.strictEqual(attempt.status, AttemptStatus.Failure);
                assert.strictEqual(attempt.data, null);
                assert.strictEqual(attempt.error, error);
                assert.strictEqual((attempt.error as CustomError).code, 404);
            });
        });
    });

    describe("Instance Methods", () => {
        describe("isOk", () => {
            it("should return true for successful attempts", () => {
                const attempt = Attempt.ok("data");
                assert.strictEqual(attempt.isOk(), true);
            });

            it("should return false for partial attempts", () => {
                const attempt = Attempt.partial("data", new Error("error"));
                assert.strictEqual(attempt.isOk(), false);
            });

            it("should return false for failed attempts", () => {
                const attempt = Attempt.fail(new Error("error"));
                assert.strictEqual(attempt.isOk(), false);
            });
        });

        describe("isPartial", () => {
            it("should return false for successful attempts", () => {
                const attempt = Attempt.ok("data");
                assert.strictEqual(attempt.isPartial(), false);
            });

            it("should return true for partial attempts", () => {
                const attempt = Attempt.partial("data", new Error("error"));
                assert.strictEqual(attempt.isPartial(), true);
            });

            it("should return false for failed attempts", () => {
                const attempt = Attempt.fail(new Error("error"));
                assert.strictEqual(attempt.isPartial(), false);
            });
        });

        describe("isFailure", () => {
            it("should return false for successful attempts", () => {
                const attempt = Attempt.ok("data");
                assert.strictEqual(attempt.isFailure(), false);
            });

            it("should return false for partial attempts", () => {
                const attempt = Attempt.partial("data", new Error("error"));
                assert.strictEqual(attempt.isFailure(), false);
            });

            it("should return true for failed attempts", () => {
                const attempt = Attempt.fail(new Error("error"));
                assert.strictEqual(attempt.isFailure(), true);
            });
        });

        describe("isError", () => {
            it("should return false for successful attempts", () => {
                const attempt = Attempt.ok("data");
                assert.strictEqual(attempt.isError(), false);
            });

            it("should return true for partial attempts", () => {
                const attempt = Attempt.partial("data", new Error("error"));
                assert.strictEqual(attempt.isError(), true);
            });

            it("should return true for failed attempts", () => {
                const attempt = Attempt.fail(new Error("error"));
                assert.strictEqual(attempt.isError(), true);
            });
        });

        describe("unwrap", () => {
            it("should return data for successful attempts", () => {
                const data = "test data";
                const attempt = Attempt.ok(data);
                assert.strictEqual(attempt.unwrap(), data);
            });

            it("should throw error for partial attempts", () => {
                const error = new Error("Partial error");
                const attempt = Attempt.partial("data", error);
                assert.throws(() => attempt.unwrap(), error);
            });

            it("should throw error for failed attempts", () => {
                const error = new Error("Failure error");
                const attempt = Attempt.fail(error);
                assert.throws(() => attempt.unwrap(), error);
            });

            it("should work with complex data types", () => {
                const data = { complex: { nested: [1, 2, 3] } };
                const attempt = Attempt.ok(data);
                assert.deepStrictEqual(attempt.unwrap(), data);
            });
        });

        describe("partialUnwrap", () => {
            it("should return data for successful attempts", () => {
                const data = "test data";
                const attempt = Attempt.ok(data);
                assert.strictEqual(attempt.partialUnwrap(), data);
            });

            it("should return data for partial attempts", () => {
                const data = "partial data";
                const attempt = Attempt.partial(data, new Error("error"));
                assert.strictEqual(attempt.partialUnwrap(), data);
            });

            it("should throw error for failed attempts", () => {
                const error = new Error("Failure error");
                const attempt = Attempt.fail(error);
                assert.throws(() => attempt.partialUnwrap(), error);
            });
        });

        describe("map", () => {
            it("should transform data for successful attempts", () => {
                const attempt = Attempt.ok(5);
                const mapped = attempt.map((x) => x * 2);

                assert.strictEqual(mapped.status, AttemptStatus.Ok);
                assert.strictEqual(mapped.data, 10);
                assert.strictEqual(mapped.error, null);
            });

            it("should transform data for partial attempts while preserving error", () => {
                const error = new Error("Partial error");
                const attempt = Attempt.partial(5, error);
                const mapped = attempt.map((x) => x * 2);

                assert.strictEqual(mapped.status, AttemptStatus.Partial);
                assert.strictEqual(mapped.data, 10);
                assert.strictEqual(mapped.error, error);
            });

            it("should preserve error for failed attempts", () => {
                const error = new Error("Failure error");
                const attempt = Attempt.fail<number>(error);
                const mapped = attempt.map((x) => x * 2);

                assert.strictEqual(mapped.status, AttemptStatus.Failure);
                assert.strictEqual(mapped.data, null);
                assert.strictEqual(mapped.error, error);
            });

            it("should work with type transformations", () => {
                const attempt = Attempt.ok("123");
                const mapped = attempt.map((str) => Number.parseInt(str, 10));

                assert.strictEqual(mapped.status, AttemptStatus.Ok);
                assert.strictEqual(mapped.data, 123);
                assert.strictEqual(mapped.error, null);
            });

            it("should work with complex transformations", () => {
                const attempt = Attempt.ok([1, 2, 3]);
                const mapped = attempt.map((arr) => arr.reduce((sum, val) => sum + val, 0));

                assert.strictEqual(mapped.status, AttemptStatus.Ok);
                assert.strictEqual(mapped.data, 6);
                assert.strictEqual(mapped.error, null);
            });
        });

        describe("and", () => {
            it("should return other when this is Ok", () => {
                const first = Attempt.ok("first");
                const second = Attempt.ok("second");
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, null);
            });

            it("should return partial with this error when this is Ok and other is Partial", () => {
                const first = Attempt.ok("first");
                const error = new Error("Other error");
                const second = Attempt.partial("second", error);
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, error);
            });

            it("should return failure when this is Ok and other is Failure", () => {
                const first = Attempt.ok("first");
                const error = new Error("Other error");
                const second = Attempt.fail(error);
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, error);
            });

            it("should return partial with this error when this is Partial and other is Ok", () => {
                const thisError = new Error("This error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.ok("second");
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, thisError);
            });

            it("should return partial with this error when both are Partial", () => {
                const thisError = new Error("This error");
                const otherError = new Error("Other error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.partial("second", otherError);
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, thisError);
            });

            it("should return failure when this is Partial and other is Failure", () => {
                const thisError = new Error("This error");
                const otherError = new Error("Other error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.fail(otherError);
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, otherError);
            });

            it("should return failure with this error when this is Failure", () => {
                const thisError = new Error("This error");
                const first = Attempt.fail(thisError);
                const second = Attempt.ok("second");
                const result = first.and(second);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, thisError);
            });
        });

        describe("or", () => {
            it("should return this when this is Ok", () => {
                const first = Attempt.ok("first");
                const second = Attempt.ok("second");
                const result = first.or(second);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, "first");
                assert.strictEqual(result.error, null);
            });

            it("should return partial with other data when this is Partial and other is Ok", () => {
                const thisError = new Error("This error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.ok("second");
                const result = first.or(second);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, thisError);
            });

            it("should return partial with other error when both are Partial", () => {
                const thisError = new Error("This error");
                const otherError = new Error("Other error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.partial("second", otherError);
                const result = first.or(second);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.strictEqual(result.data, "second");
                assert.strictEqual(result.error, otherError);
            });

            it("should return failure when this is Partial and other is Failure", () => {
                const thisError = new Error("This error");
                const otherError = new Error("Other error");
                const first = Attempt.partial("first", thisError);
                const second = Attempt.fail(otherError);
                const result = first.or(second);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, otherError);
            });

            it("should return failure with this error when this is Failure", () => {
                const thisError = new Error("This error");
                const first = Attempt.fail(thisError);
                const second = Attempt.ok("second");
                const result = first.or(second);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, thisError);
            });
        });

        describe("flat", () => {
            it("should flatten single-level nested Attempts", () => {
                const inner = Attempt.ok("inner data");
                const outer = Attempt.ok(inner);
                const flattened = outer.flat();

                assert.strictEqual(flattened.status, AttemptStatus.Ok);
                assert.strictEqual(flattened.data, "inner data");
                assert.strictEqual(flattened.error, null);
            });

            it("should flatten multiple-level nested Attempts", () => {
                const innermost = Attempt.ok("innermost data");
                const middle = Attempt.ok(innermost);
                const outer = Attempt.ok(middle);
                const flattened = outer.flat();

                assert.strictEqual(flattened.status, AttemptStatus.Ok);
                assert.strictEqual(flattened.data, "innermost data");
                assert.strictEqual(flattened.error, null);
            });

            it("should preserve the highest error status when flattening", () => {
                const error1 = new Error("Inner error");
                const error2 = new Error("Outer error");
                const inner = Attempt.partial("inner data", error1);
                const outer = Attempt.partial(inner, error2);
                const flattened = outer.flat();

                assert.strictEqual(flattened.status, AttemptStatus.Partial);
                assert.strictEqual(flattened.data, "inner data");
                assert.strictEqual(flattened.error, error2); // First non-null error
            });

            it("should handle failure status correctly", () => {
                const error1 = new Error("Inner error");
                const error2 = new Error("Outer error");
                const inner = Attempt.fail(error1);
                const outer = Attempt.partial(inner, error2);
                const flattened = outer.flat();

                assert.strictEqual(flattened.status, AttemptStatus.Failure);
                assert.strictEqual(flattened.data, null);
                assert.strictEqual(flattened.error, error2); // First non-null error
            });

            it("should not flatten non-Attempt data", () => {
                const attempt = Attempt.ok("regular data");
                const flattened = attempt.flat();

                assert.strictEqual(flattened.status, AttemptStatus.Ok);
                assert.strictEqual(flattened.data, "regular data");
                assert.strictEqual(flattened.error, null);
            });

            it("should respect depth parameter", () => {
                const innermost = Attempt.ok("innermost");
                const middle = Attempt.ok(innermost);
                const outer = Attempt.ok(middle);
                const flattened = outer.flat(1);

                assert.strictEqual(flattened.status, AttemptStatus.Ok);
                assert.strictEqual(flattened.data, innermost);
                assert.strictEqual(flattened.error, null);
            });

            it("should handle depth of 0", () => {
                const inner = Attempt.ok("inner");
                const outer = Attempt.ok(inner);
                const flattened = outer.flat(0);

                assert.strictEqual(flattened.status, AttemptStatus.Ok);
                assert.strictEqual(flattened.data, inner);
                assert.strictEqual(flattened.error, null);
            });
        });
    });

    describe("Static Utility Methods", () => {
        describe("try", () => {
            it("should wrap successful synchronous functions", () => {
                const fn = () => "success";
                const result = Attempt.try(fn);

                if (result instanceof Promise) {
                    assert.fail("Expected synchronous result");
                }

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, "success");
                assert.strictEqual(result.error, null);
            });

            it("should catch errors from synchronous functions", () => {
                const error = new Error("Sync error");
                const fn = (): string => {
                    throw error;
                };
                const result = Attempt.try(fn);

                if (result instanceof Promise) {
                    assert.fail("Expected synchronous result");
                }

                const syncResult = result;
                assert.strictEqual(syncResult.status, AttemptStatus.Failure);
                assert.strictEqual(syncResult.data, null);
                assert.strictEqual(syncResult.error, error);
            });

            it("should handle successful async functions", async () => {
                const fn = async () => "async success";
                const result = await Attempt.try(fn);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, "async success");
                assert.strictEqual(result.error, null);
            });

            it("should catch errors from async functions", async () => {
                const error = new Error("Async error");
                const fn = async () => {
                    throw error;
                };
                const result = await Attempt.try(fn);

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, error);
            });

            it("should handle functions that return null", () => {
                const fn = () => null;
                const result = Attempt.try(fn);

                if (result instanceof Promise) {
                    assert.fail("Expected synchronous result");
                }

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, null);
                assert.strictEqual(result.error, null);
            });

            it("should handle functions that return undefined", () => {
                const fn = () => undefined;
                const result = Attempt.try(fn);

                if (result instanceof Promise) {
                    assert.fail("Expected synchronous result");
                }

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.strictEqual(result.data, undefined);
                assert.strictEqual(result.error, null);
            });

            it("should preserve original error types", () => {
                class CustomError extends Error {
                    constructor(
                        message: string,
                        public code: number,
                    ) {
                        super(message);
                        this.name = "CustomError";
                    }
                }

                const error = new CustomError("Custom error", 500);
                const fn = (): string => {
                    throw error;
                };
                const result = Attempt.try(fn);

                if (result instanceof Promise) {
                    assert.fail("Expected synchronous result");
                }

                assert.strictEqual(result.status, AttemptStatus.Failure);
                assert.strictEqual(result.error, error);
                assert.strictEqual((result.error as CustomError).code, 500);
            });
        });

        describe("all", () => {
            it("should handle all successful promises", async () => {
                const promises = [Promise.resolve("first"), Promise.resolve("second"), Promise.resolve("third")];
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, ["first", "second", "third"]);
                assert.strictEqual(result.error, null);
            });

            it("should handle mixed success and failure", async () => {
                const error = new Error("Promise error");
                const promises = [
                    Promise.resolve("success"),
                    Promise.reject(error),
                    Promise.resolve("another success"),
                ];
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.deepStrictEqual(result.data, ["success", "another success"]);
                assert.strictEqual(result.error, error);
            });

            it("should handle all failed promises", async () => {
                const error1 = new Error("First error");
                const error2 = new Error("Second error");
                const promises = [Promise.reject(error1), Promise.reject(error2)];
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Partial);
                assert.deepStrictEqual(result.data, []);
                assert.strictEqual(result.error, error1); // First error
            });

            it("should handle empty array", async () => {
                const promises: Promise<string>[] = [];
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, []);
                assert.strictEqual(result.error, null);
            });

            it("should handle immediate values", async () => {
                const values = ["immediate1", "immediate2"];
                const result = await Attempt.all(values);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, ["immediate1", "immediate2"]);
                assert.strictEqual(result.error, null);
            });

            it("should handle mixed promises and immediate values", async () => {
                const values = [Promise.resolve("promise"), "immediate", Promise.resolve("another promise")];
                const result = await Attempt.all(values);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, ["promise", "immediate", "another promise"]);
                assert.strictEqual(result.error, null);
            });

            it("should preserve tuple types for readonly arrays", async () => {
                const promises = [Promise.resolve(1), Promise.resolve("string"), Promise.resolve(true)] as const;
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, [1, "string", true]);
                assert.strictEqual(result.error, null);
            });

            it("should handle iterable input", async () => {
                const set = new Set([Promise.resolve("from set 1"), Promise.resolve("from set 2")]);
                const result = await Attempt.all(set);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, ["from set 1", "from set 2"]);
                assert.strictEqual(result.error, null);
            });

            it("should handle async functions that return different types", async () => {
                const promises = [
                    Promise.resolve(42),
                    Promise.resolve("text"),
                    Promise.resolve({ key: "value" }),
                    Promise.resolve([1, 2, 3]),
                ];
                const result = await Attempt.all(promises);

                assert.strictEqual(result.status, AttemptStatus.Ok);
                assert.deepStrictEqual(result.data, [42, "text", { key: "value" }, [1, 2, 3]]);
                assert.strictEqual(result.error, null);
            });
        });
    });

    describe("Type Guards and Type Safety", () => {
        it("should properly narrow types with type guards", () => {
            const okAttempt = Attempt.ok("success");
            const partialAttempt = Attempt.partial("data", new Error("error"));
            const failAttempt = Attempt.fail(new Error("failure"));

            // Type narrowing with isOk
            if (okAttempt.isOk()) {
                // TypeScript should know that okAttempt.data is string and error is null
                assert.strictEqual(typeof okAttempt.data, "string");
                assert.strictEqual(okAttempt.error, null);
            } else {
                assert.fail("Should be Ok");
            }

            // Type narrowing with isPartial
            if (partialAttempt.isPartial()) {
                // TypeScript should know that partialAttempt.data is string and error is Error
                assert.strictEqual(typeof partialAttempt.data, "string");
                assert.ok(partialAttempt.error instanceof Error);
            } else {
                assert.fail("Should be Partial");
            }

            // Type narrowing with isFailure
            if (failAttempt.isFailure()) {
                // TypeScript should know that failAttempt.data is null and error is Error
                assert.strictEqual(failAttempt.data, null);
                assert.ok(failAttempt.error instanceof Error);
            } else {
                assert.fail("Should be Failure");
            }
        });

        it("should handle generic type parameters correctly", () => {
            interface TestData {
                id: number;
                name: string;
            }

            const data: TestData = { id: 1, name: "test" };
            const attempt = Attempt.ok(data);

            assert.strictEqual(attempt.data.id, 1);
            assert.strictEqual(attempt.data.name, "test");
        });
    });

    describe("Edge Cases and Error Handling", () => {
        it("should handle circular references in data", () => {
            interface CircularObj {
                name: string;
                self?: CircularObj;
            }

            const obj: CircularObj = { name: "test" };
            obj.self = obj;

            const attempt = Attempt.ok(obj);
            assert.strictEqual(attempt.status, AttemptStatus.Ok);
            assert.strictEqual(attempt.data.name, "test");
            assert.strictEqual(attempt.data.self, obj);
        });

        it("should handle very large data structures", () => {
            const largeArray = new Array(10000).fill(0).map((_, i) => i);
            const attempt = Attempt.ok(largeArray);

            assert.strictEqual(attempt.status, AttemptStatus.Ok);
            assert.strictEqual(attempt.data.length, 10000);
            assert.strictEqual(attempt.data[9999], 9999);
        });

        it("should preserve error stack traces", () => {
            const error = new Error("Test error");
            const originalStack = error.stack;
            const attempt = Attempt.fail(error);

            assert.strictEqual(attempt.error?.stack, originalStack);
        });

        it("should handle errors without messages", () => {
            const error = new Error();
            const attempt = Attempt.fail(error);

            assert.strictEqual(attempt.status, AttemptStatus.Failure);
            assert.strictEqual(attempt.error, error);
        });

        it("should handle non-Error objects as errors", () => {
            const errorLike = { message: "Not an Error instance" };
            // This tests the (err as Error) casting in the implementation
            const fn = (): string => {
                throw errorLike;
            };
            const result = Attempt.try(fn);

            assert.strictEqual(result.status, AttemptStatus.Failure);
            assert.strictEqual(result.error, errorLike);
        });
    });

    describe("Real-world Usage Patterns", () => {
        it("should chain multiple operations with map and and", () => {
            const parseNumber = (str: string) => {
                const num = Number.parseInt(str, 10);
                return Number.isNaN(num) ? Attempt.fail<number>(new Error("Invalid number")) : Attempt.ok(num);
            };

            const validatePositive = (num: number) => {
                return num > 0 ? Attempt.ok(num) : Attempt.fail<number>(new Error("Must be positive"));
            };

            const input = "42";
            const result = parseNumber(input)
                .and(validatePositive(42))
                .map((num) => num * 2);

            assert.strictEqual(result.status, AttemptStatus.Ok);
            assert.strictEqual(result.data, 84);
        });

        it("should handle repository-like operations with partial data", () => {
            // Simulating a repository that can return partial data on rate limit
            const fetchUsers = (ids: number[]) => {
                if (ids.length > 5) {
                    // Simulate rate limit - return first 5 users with error
                    const partialData = ids.slice(0, 5).map((id) => ({ id, name: `User ${id}` }));
                    return Attempt.partial(partialData, new Error("Rate limited"));
                }
                const data = ids.map((id) => ({ id, name: `User ${id}` }));
                return Attempt.ok(data);
            };

            const smallRequest = fetchUsers([1, 2, 3]);
            assert.strictEqual(smallRequest.status, AttemptStatus.Ok);
            assert.strictEqual(smallRequest.data.length, 3);

            const largeRequest = fetchUsers([1, 2, 3, 4, 5, 6, 7, 8]);
            assert.strictEqual(largeRequest.status, AttemptStatus.Partial);
            assert.strictEqual(largeRequest.data.length, 5);
            assert.ok(largeRequest.error?.message.includes("Rate limited"));
        });

        it("should handle async operations with error recovery", async () => {
            const flakyApiCall = async (shouldFail: boolean) => {
                if (shouldFail) {
                    throw new Error("API unavailable");
                }
                return "API response";
            };

            const withRetry = async () => {
                const firstAttempt = await Attempt.try(() => flakyApiCall(true));
                if (firstAttempt.isOk()) {
                    return firstAttempt;
                }

                // Fallback to cached data - we know error exists since it's not OK
                const error = firstAttempt.error;
                if (!error) {
                    throw new Error("Expected error to exist");
                }
                return Attempt.partial("cached data", error);
            };

            const result = await withRetry();
            assert.strictEqual(result.status, AttemptStatus.Partial);
            assert.strictEqual(result.data, "cached data");
            assert.ok(result.error?.message.includes("API unavailable"));
        });

        it("should aggregate results from multiple sources", async () => {
            const sources = [
                Promise.resolve("source1"),
                Promise.reject(new Error("source2 failed")),
                Promise.resolve("source3"),
                Promise.reject(new Error("source4 failed")),
            ];

            const aggregated = await Attempt.all(sources);

            assert.strictEqual(aggregated.status, AttemptStatus.Partial);
            assert.deepStrictEqual(aggregated.data, ["source1", "source3"]);
            assert.ok(aggregated.error?.message.includes("source2 failed"));

            // Can still use partial data
            assert.deepStrictEqual(aggregated.data, ["source1", "source3"]);
        });
    });
});
