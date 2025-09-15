import { type RequestHandler, text } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const GET: RequestHandler = async ({ fetch, url }) => {
	// In tests we call the handler directly, so always return a Response instead of throwing
	if (!dev) return text("Not found", { status: 404 });

	// Allow configurable limit via query parameter, default to 50 (much smaller than 1000)
	const limitParam = url.searchParams.get("limit");
	const count = limitParam ? parseInt(limitParam, 10) : 50;
	const size = 10;
	const includeMetrics = url.searchParams.get("metrics") === "true";

	if (Number.isNaN(count) || count < 1 || count > 200) {
		return text("Invalid limit parameter. Must be between 1 and 200.", { status: 400 });
	}

	let totalFetches = 0;
	let successfulFetches = 0;
	let failedFetches = 0;
	const results: Array<Response | undefined> = [];

	for (let i = 0; i < count; i += size) {
		try {
			const batchSize = Math.min(size, count - i);
			const batchPromises = new Array(batchSize).fill(0).map(async () => {
				totalFetches++;
				try {
					const response = await fetch("https://example.com/");
					successfulFetches++;
					return response;
				} catch {
					failedFetches++;
					return undefined;
				}
			});

			const batchResults = await Promise.allSettled(batchPromises);
			results.push(...batchResults.map((r) => (r.status === "fulfilled" ? r.value : undefined)));
		} catch {
			// Batch failed entirely (likely due to fetch limit)
			break;
		}
	}

	const completionData = {
		expected: count,
		attempted: totalFetches,
		successful: successfulFetches,
		failed: failedFetches,
		completionPercentage: count > 0 ? (successfulFetches / count) * 100 : 0,
		successRate: totalFetches > 0 ? (successfulFetches / totalFetches) * 100 : 0,
	};

	if (includeMetrics) {
		return new Response(
			JSON.stringify({
				message:
					totalFetches < count
						? `Fetch limit reached after ${totalFetches} requests. This is expected behavior.`
						: `Test failed - completed all ${totalFetches} requests without hitting limit`,
				metrics: completionData,
				hitLimit: totalFetches < count,
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (totalFetches < count) {
		return text(
			`Fetch limit reached after ${totalFetches} requests (${successfulFetches} successful, ${failedFetches} failed). Completion: ${completionData.completionPercentage.toFixed(1)}%. This is expected behavior.`,
		);
	}

	return text(`Test failed - completed all ${totalFetches} requests without hitting limit`, { status: 500 });
};
