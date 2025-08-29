import { type ProjectDB, SteamAuthenticatedAPIClient, VaultService, type schema } from "@project/lib";
import { drizzle } from "drizzle-orm/d1";
import { getJobsForCron } from "./jobs";

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
    scheduled: async (event, env, ctx) => {
        const db = drizzle<typeof schema>(env.DB) as unknown as ProjectDB; // TODO: Fix this type
        const service = new VaultService(db, new SteamAuthenticatedAPIClient(env.STEAM_API_KEY));
        const now = new Date();

        const cron = event.cron;
        const targets = getJobsForCron(cron);

        if (targets.length === 0) return;

        for (const job of targets) {
            try {
                await job.run({ db, service, now, ctx });
            } catch (err) {
                console.error(`[scheduled] job=${job.id} error=${(err as Error).message}`);
            }
        }
    },
} satisfies ExportedHandler<Env>;
