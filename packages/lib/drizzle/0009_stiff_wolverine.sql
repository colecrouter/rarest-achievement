CREATE TABLE `steam_charts_snapshots` (
	`app_id` integer PRIMARY KEY NOT NULL,
	`all_time_peak` integer NOT NULL,
	`avg_count` real NOT NULL,
	`day_peak` integer NOT NULL,
	`recent_points` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_steam_charts_snapshots_timestamp` ON `steam_charts_snapshots` (`updated_at`);