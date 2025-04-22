import type { ExportedHandler } from "@cloudflare/workers-types";
import { type ProjectDB, SteamAuthenticatedAPIClient, type schema } from "@project/lib";
import { drizzle } from "drizzle-orm/d1";
import { refreshStaleApps } from "./cleanup";

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
    scheduled: async (scheduledTime, env, ctx) => {
        const db = drizzle<typeof schema>(env.DB) as unknown as ProjectDB; // TODO: Fix this type
        const api = new SteamAuthenticatedAPIClient(env.STEAM_API_KEY);

        refreshStaleApps(db, api, 100);

        // TODO delete old user data
        // I haven't decided what data I want for global stats yet
    },
} satisfies ExportedHandler<Env>;
