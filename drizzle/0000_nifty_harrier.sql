CREATE TABLE `achievements_meta` (
	`app_id` integer NOT NULL,
	`lang` text NOT NULL,
	`data` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `lang`),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`appid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_achievements_meta_timestamp` ON `achievements_meta` (`updated_at`);--> statement-breakpoint
CREATE TABLE `achievements_stats` (
	`app_id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`appid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_achievements_stats_timestamp` ON `achievements_stats` (`updated_at`);--> statement-breakpoint
CREATE TABLE `apps` (
	`appid` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_apps_timestamp` ON `apps` (`updated_at`);--> statement-breakpoint
CREATE TABLE `friends` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_friends_timestamp` ON `friends` (`updated_at`);--> statement-breakpoint
CREATE TABLE `owned_games` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_owned_games_timestamp` ON `owned_games` (`updated_at`);--> statement-breakpoint
CREATE TABLE `user_achievements_stats` (
	`user_id` text NOT NULL,
	`app_id` integer NOT NULL,
	`data` text,
	`updated_at` integer,
	PRIMARY KEY(`user_id`, `app_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`appid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_achievements_timestamp` ON `user_achievements_stats` (`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_timestamp` ON `users` (`updated_at`);