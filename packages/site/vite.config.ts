import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import legacy from "vite-plugin-sveltekit-legacy";
import { defineConfig } from "vitest/config";

export default defineConfig((env) => ({
	plugins: [
		env.mode === "production"
			? sentrySvelteKit({
					sourceMapsUploadOptions: {
						org: "cole-crouter",
						project: "steam-vault",
					},
				})
			: undefined,
		tailwindcss(), // @ts-ignore
		sveltekit(),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/lib/paraglide",
			strategy: ["url", "preferredLanguage", "baseLocale"],
			disableAsyncLocalStorage: true,
		}),
		env.command === "build" && env.mode === "production" && !env.isSsrBuild
			? legacy({
					modernTargets: ["defaults", "not IE 11"],
				})
			: undefined,
	],
	test: {
		projects: [
			{
				extends: "./vite.config.ts",
				plugins: [svelteTesting()],

				test: {
					name: "client",
					environment: "jsdom",
					clearMocks: true,
					include: ["src/**/*.{test,spec}.{js,ts}"],
					exclude: ["src/lib/server/**"],
					setupFiles: ["./vitest-setup-client.ts"],
				},
			},
			{
				extends: "./vite.config.ts",

				test: {
					name: "server",
					environment: "node",
					include: ["src/lib/server/**/*.{test,spec}.{js,ts}"],
					exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
				},
			},
		],
	},
	server: {
		fs: {
			allow: ["../.."],
		},
	},
}));
