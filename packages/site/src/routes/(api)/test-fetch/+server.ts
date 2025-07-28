import { dev } from "$app/environment";
import { error, text, type RequestHandler } from "@sveltejs/kit";

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
        } catch (error) {
            return text("Success!");
        }
    }

    return error(500, "Test failed");
};
