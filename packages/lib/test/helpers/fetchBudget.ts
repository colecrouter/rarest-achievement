/**
 * Local fetch budget helper for tests.
 *
 * Rationale: Repository code resets the global FetchManager sub-config during ensure phases,
 * which would override a test-provided budget. To get deterministic control, we decorate
 * mock API methods with a simple per-test counter that throws after N calls.
 */

export interface LocalBudget {
	inc(): void;
	used(): number;
}

/**
 * Create a new local budget with the specified max invocations.
 */
export function createLocalBudget(limit: number): LocalBudget {
	let count = 0;
	return {
		inc() {
			count++;
			if (count > limit) {
				throw new Error(`Synthetic fetch budget exceeded: ${count}/${limit}`);
			}
		},
		used() {
			return count;
		},
	};
}

/**
 * Decorate given methods on an object to charge against the provided budget.
 * Useful for mock API clients where each method represents one network call.
 */
export function decorateWithBudget<T extends object, K extends keyof T>(
	obj: T,
	methods: K[],
	budget: LocalBudget,
): void {
	for (const name of methods) {
		const orig = obj[name];
		if (typeof orig !== "function") continue;
		// Preserve 'this' and arguments; charge budget before invoking original
		const fn = orig as unknown as (...args: unknown[]) => unknown;
		obj[name] = function decorated(this: unknown, ...args: unknown[]) {
			try {
				budget.inc();
			} catch (e) {
				// Convert sync over-budget error into an async rejection to avoid short-circuiting
				// array mapping in caller code (which expects Promises).
				return Promise.reject(e);
			}
			try {
				return fn.apply(this, args);
			} catch (e) {
				return Promise.reject(e);
			}
		} as T[K];
	}
}
