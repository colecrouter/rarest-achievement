import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import { FetchManager, getFetchManager, setFetchManager } from "./fetchManager.js";

describe("FetchManager", () => {
	let manager: FetchManager;

	beforeEach(() => {
		manager = new FetchManager();
	});

	describe("constructor and defaults", () => {
		test("should initialize with default values", () => {
			assert.strictEqual(manager.fetchCount, 0);
			assert.strictEqual(manager.totalFetchCount, 0);
			assert.strictEqual(manager.remainingFetches, FetchManager.MAX_FETCHES);
			assert.strictEqual(manager.isAborted(), false);
			assert.strictEqual(manager.hasHitLimit(), false);
			assert.strictEqual(manager.isNearLimit(), false);
		});

		test("should have correct MAX_FETCHES constant", () => {
			assert.strictEqual(FetchManager.MAX_FETCHES, 800);
		});
	});

	describe("configuration", () => {
		test("should reset with new configuration", () => {
			// Set up initial state
			manager.incrementFetchCount();
			manager.incrementFetchCount();
			assert.strictEqual(manager.fetchCount, 2);

			// Reset with new config
			const config = { maxFetches: 100 };
			manager.reset(config);

			assert.strictEqual(manager.fetchCount, 0);
			assert.strictEqual(manager.totalFetchCount, 2); // Total should not reset
			assert.strictEqual(manager.remainingFetches, 100);
			assert.deepStrictEqual(manager.config, config);
		});

		test("should calculate remaining fetches based on config limit", () => {
			manager.reset({ maxFetches: 50 });
			manager.incrementFetchCount();
			manager.incrementFetchCount();

			assert.strictEqual(manager.remainingFetches, 48);
		});

		test("should use global limit when config limit is higher", () => {
			manager.reset({ maxFetches: 1000 }); // Higher than MAX_FETCHES

			// Add fetches close to global limit
			for (let i = 0; i < 795; i++) {
				manager.incrementFetchCount();
			}

			assert.strictEqual(manager.remainingFetches, 5); // Should be limited by global limit
		});
	});

	describe("fetch counting", () => {
		test("should increment fetch counts correctly", () => {
			manager.incrementFetchCount();
			assert.strictEqual(manager.fetchCount, 1);
			assert.strictEqual(manager.totalFetchCount, 1);

			manager.incrementFetchCount();
			assert.strictEqual(manager.fetchCount, 2);
			assert.strictEqual(manager.totalFetchCount, 2);
		});

		test("should maintain total count across resets", () => {
			manager.incrementFetchCount();
			manager.incrementFetchCount();

			manager.reset({ maxFetches: 100 });

			manager.incrementFetchCount();

			assert.strictEqual(manager.fetchCount, 1);
			assert.strictEqual(manager.totalFetchCount, 3);
		});
	});

	describe("limit detection", () => {
		test("should detect near limit based on config", () => {
			manager.reset({ maxFetches: 100 });

			// Add fetches to 80% of limit (warning threshold)
			for (let i = 0; i < 79; i++) {
				manager.incrementFetchCount();
			}
			assert.strictEqual(manager.isNearLimit(), false);

			manager.incrementFetchCount(); // Now at 80
			assert.strictEqual(manager.isNearLimit(), true);
		});

		test("should detect hit limit and auto-abort", () => {
			manager.reset({ maxFetches: 5 });

			// Add fetches up to limit
			for (let i = 0; i < 4; i++) {
				manager.incrementFetchCount();
				assert.strictEqual(manager.hasHitLimit(), false);
				assert.strictEqual(manager.isAborted(), false);
			}

			// Hit the limit
			manager.incrementFetchCount();
			assert.strictEqual(manager.hasHitLimit(), true);
			assert.strictEqual(manager.isAborted(), true);
		});

		test("should detect global limit hit", () => {
			manager.reset({ maxFetches: 1000 }); // High config limit

			// Add fetches to global limit
			for (let i = 0; i < FetchManager.MAX_FETCHES - 1; i++) {
				manager.incrementFetchCount();
			}
			assert.strictEqual(manager.hasHitLimit(), false);

			manager.incrementFetchCount(); // Hit global limit
			assert.strictEqual(manager.hasHitLimit(), true);
			assert.strictEqual(manager.isAborted(), true);
		});
	});

	describe("abort functionality", () => {
		test("should provide abort signal", () => {
			const signal = manager.abortSignal;
			assert.strictEqual(signal instanceof AbortSignal, true);
			assert.strictEqual(signal.aborted, false);
		});

		test("should abort when limit is hit", () => {
			manager.reset({ maxFetches: 2 });

			const signal = manager.abortSignal;
			manager.incrementFetchCount();
			manager.incrementFetchCount(); // Hit limit

			// Need to call hasHitLimit() to trigger the abort
			manager.hasHitLimit();

			assert.strictEqual(signal.aborted, true);
		});
	});

	describe("status and summary", () => {
		test("should provide accurate summary", () => {
			manager.reset({ maxFetches: 100 });
			manager.incrementFetchCount();
			manager.incrementFetchCount();

			const summary = manager.getSummary();

			assert.strictEqual(summary.used, 2);
			assert.strictEqual(summary.total, 100);
			assert.strictEqual(summary.totalUsed, 2);
			assert.strictEqual(summary.remaining, 98);
			assert.strictEqual(summary.percentUsed, 2);
			assert.strictEqual(summary.isNearLimit, false);
			assert.strictEqual(summary.hasHitLimit, false);
			assert.strictEqual(typeof summary.elapsedMs, "number");
			assert.strictEqual(summary.elapsedMs >= 0, true);
		});

		test("should log status without throwing", () => {
			// This is mainly to ensure the log methods don't crash
			manager.reset({ maxFetches: 10 });
			manager.incrementFetchCount();

			// Should not throw
			manager.logStatus();
		});
	});

	describe("global manager", () => {
		test("should get global manager instance", () => {
			const globalManager = getFetchManager();
			assert.strictEqual(globalManager instanceof FetchManager, true);

			// Should return same instance
			const sameManager = getFetchManager();
			assert.strictEqual(globalManager, sameManager);
		});

		test("should set new global manager", () => {
			const newManager = new FetchManager();
			setFetchManager(newManager);

			const retrievedManager = getFetchManager();
			assert.strictEqual(retrievedManager, newManager);
		});
	});

	describe("edge cases", () => {
		test("should handle zero fetch limit", () => {
			manager.reset({ maxFetches: 0 });

			assert.strictEqual(manager.remainingFetches, 0);
			assert.strictEqual(manager.hasHitLimit(), true);
			assert.strictEqual(manager.isAborted(), true);
		});

		test("should handle very small limits", () => {
			manager.reset({ maxFetches: 1 });

			manager.incrementFetchCount();
			assert.strictEqual(manager.hasHitLimit(), true);
			assert.strictEqual(manager.isAborted(), true);
		});

		test("should calculate remaining fetches correctly with mixed limits", () => {
			// Start with a high config limit
			manager.reset({ maxFetches: 1000 });

			// Add fetches close to global limit
			for (let i = 0; i < 790; i++) {
				manager.incrementFetchCount();
			}

			// Reset with lower config limit
			manager.reset({ maxFetches: 50 });

			// Remaining should be limited by global limit (10 remaining)
			// since totalFetchCount is 790
			assert.strictEqual(manager.remainingFetches, 10);
		});
	});

	describe("performance considerations", () => {
		test("should handle many increments efficiently", () => {
			manager.reset({ maxFetches: 1000 });

			const start = Date.now();
			for (let i = 0; i < 500; i++) {
				manager.incrementFetchCount();
			}
			const end = Date.now();

			// Should complete quickly (arbitrary threshold)
			assert.strictEqual(end - start < 100, true);
			assert.strictEqual(manager.fetchCount, 500);
		});
	});
});
