import type { ProjectDB, VaultService } from "@project/lib";
import { cleanupUserData, refreshStaleApps } from "./cleanup";
import { refreshRareCount } from "./score";

export interface CronCtx {
	db: ProjectDB;
	service: VaultService;
	now: Date;
	ctx: ExecutionContext;
}

export interface CronJob {
	id: string;
	cron: string; // cron expression string matching platform schedule
	run: (ctx: CronCtx) => Promise<void>;
}

export const jobs = [
	{
		id: "calculateUserScores",
		cron: "0 */2 * * *", // every 2 hours
		run: refreshRareCount,
	},
	{
		id: "refreshStaleApps",
		cron: "15 3 * * *", // daily 03:15
		run: refreshStaleApps,
	},
	{
		id: "cleanupUserData",
		cron: "45 4 * * 1", // weekly Monday 04:45
		run: cleanupUserData,
	},
] satisfies CronJob[];

export function getJobsForCron(cron: string): CronJob[] {
	return jobs.filter((j) => j.cron === cron);
}
