import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			lib: "../../packages/lib/src/index",
		},
		csp: {
			directives: {
				"default-src": ["self"],
				"img-src": [
					"self",
					"data:",
					// Achievement icons
					"https://shared.akamai.steamstatic.com/",
					"https://store.akamai.steamstatic.com/",
					"https://steamcdn-a.akamaihd.net/",
					"https://cdn.cloudflare.steamstatic.com/",
					// User avatars
					"https://avatars.steamstatic.com/",
					"https://cdn.fastly.steamstatic.com/",
					"https://avatars.fastly.steamstatic.com/",
					// Steam guide images
					"https://images.steamusercontent.com/",
					// YouTube thumbnails
					"https://i.ytimg.com/",
				],
				"style-src": ["self", "unsafe-inline"],
				"script-src": ["self", "sha256-y2WkUILyE4eycy7x+pC0z99aZjTZlWfVwgUAfNc1sY8="],
				"connect-src": ["self", "*.sentry.io", "*.ingest.us.sentry.io", "static.cloudflareinsights.com"],
				"worker-src": ["self", "blob:"],
			},
		},
	},
};

export default config;
