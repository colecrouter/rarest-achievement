/**
 * Mock fetch integration with FetchManager for testing.
 * Simulates the production behavior where global fetch is wrapped to respect FetchManager limits.
 */

import { getFetchManager } from "../../src/repositories/fetchManager";

interface MockFetchOptions {
	/** Original fetch to delegate to after FetchManager checks */
	originalFetch?: typeof fetch;
	/** Whether to actually make network requests (default: false) */
	makeRealRequests?: boolean;
}

/**
 * Mock fetch function that respects FetchManager limits just like production.
 * Throws when fetch limits are exceeded, matching production behavior.
 */
export function createMockFetchWithManager(options: MockFetchOptions = {}): typeof fetch {
	const { originalFetch = globalThis.fetch, makeRealRequests = false } = options;

	return async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		// Increment fetch count and check limits (like production)
		getFetchManager().incrementFetchCount();

		if (getFetchManager().hasHitLimit()) {
			const reason = `Mock fetch limit exceeded: ${getFetchManager().fetchCount}/${getFetchManager().config?.maxFetches || 800}`;
			throw new Error(reason);
		}

		// Check if request should be aborted
		if (getFetchManager().isAborted()) {
			throw new Error("Fetch aborted by FetchManager");
		}

		// If we're making real requests, use the original fetch
		if (makeRealRequests) {
			return originalFetch(input, init);
		}

		// Otherwise, return a mock response
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

		// Return a mock successful response
		return new Response(JSON.stringify({ mockResponse: true, url }), {
			status: 200,
			statusText: "OK",
			headers: {
				"Content-Type": "application/json",
			},
		});
	};
}

/**
 * Setup fetch mocking with FetchManager integration for a test.
 * Call this in beforeEach to set up the mock, and make sure to restore in afterEach.
 */
export function setupMockFetchWithManager(options: MockFetchOptions = {}): () => void {
	const originalFetch = globalThis.fetch;
	const mockFetch = createMockFetchWithManager({ ...options, originalFetch });

	// Replace global fetch
	globalThis.fetch = mockFetch;

	// Return cleanup function
	return () => {
		globalThis.fetch = originalFetch;
	};
}
