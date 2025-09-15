import { describe, expect, it, type Mock, vi } from "vitest";

// Focus: ensure handler parses limit and errors on invalid input.
vi.mock("$app/environment", () => ({ dev: true }));

describe("/test-fetch basic", () => {
	const createMockEvent = (url: string, fetchMock: Mock) => ({
		request: new Request(url),
		url: new URL(url),
		fetch: fetchMock,
		params: {},
		route: { id: null },
		// biome-ignore lint/suspicious/noExplicitAny: mock
		locals: {} as any,
		platform: undefined,
		getClientAddress: () => "127.0.0.1",
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn(),
			getAll: vi.fn(),
		},
		// biome-ignore lint/suspicious/noExplicitAny: mock
		tracing: {} as any,
		isRemoteRequest: false,
	});

	it("default limit completes all (returns 500)", async () => {
		const { GET } = await import("./+server.js");
		// Rejecting still counts attempts; handler will finish all requests
		const mockFetch = vi.fn().mockRejectedValue(new Error("fail"));
		const res = await GET(createMockEvent("http://localhost/test-fetch", mockFetch));
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(text).toContain("completed all 50 requests");
	});

	it("custom limit completes all (returns 500)", async () => {
		const { GET } = await import("./+server.js");
		const mockFetch = vi.fn().mockResolvedValue(new Response("OK"));
		const res = await GET(createMockEvent("http://localhost/test-fetch?limit=12", mockFetch));
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(text).toContain("completed all 12 requests");
	});

	it("invalid limits return 400", async () => {
		const { GET } = await import("./+server.js");
		const dummyFetch = vi.fn();
		for (const bad of ["0", "201", "abc"]) {
			const res = await GET(createMockEvent(`http://localhost/test-fetch?limit=${bad}`, dummyFetch));
			expect(res.status).toBe(400);
		}
	});
});
