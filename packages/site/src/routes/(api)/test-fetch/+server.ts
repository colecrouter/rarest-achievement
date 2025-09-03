import { error, type RequestHandler, text } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const GET: RequestHandler = async ({ fetch }) => {
	if (!dev) return error(404);

	const count = 1000;
	const size = 10;

	for (let i = 0; i < count; i += size) {
		try {
			await Promise.all(
				new Array(size).fill(0).map(() => {
					return fetch("https://example.com");
				}),
			);
		} catch {
			return text("Success!");
		}
	}

	return error(500, "Test failed");
};
