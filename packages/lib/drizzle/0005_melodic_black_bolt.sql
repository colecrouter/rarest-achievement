PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_achievements_meta` (
	`app_id` integer NOT NULL,
	`lang` text NOT NULL,
	`ach_id` text NOT NULL,
	`default_value` integer NOT NULL,
	`display_name` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`description` text,
	`icon` text NOT NULL,
	`icon_gray` text NOT NULL,
	PRIMARY KEY(`app_id`, `ach_id`, `lang`)
);
--> statement-breakpoint
INSERT INTO
	`__new_achievements_meta`(
		"app_id",
		"lang",
		"ach_id",
		"default_value",
		"display_name",
		"hidden",
		"description",
		"icon",
		"icon_gray"
	)
SELECT
	t.app_id,
	t.lang,
	json_extract(value, '$.ach_id'),
	json_extract(value, '$.default_value'),
	json_extract(value, '$.display_name'),
	json_extract(value, '$.hidden'),
	json_extract(value, '$.description'),
	json_extract(value, '$.icon'),
	json_extract(value, '$.icon_gray')
FROM
	`achievements_meta` t,
	json_each(t.data)
WHERE
	t.data IS NOT NULL
	AND json_extract(value, '$.ach_id') IS NOT NULL;--> statement-breakpoint
DROP TABLE `achievements_meta`;--> statement-breakpoint
ALTER TABLE `__new_achievements_meta` RENAME TO `achievements_meta`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_achievements_stats` (
	`app_id` integer NOT NULL,
	`ach_id` text NOT NULL,
	`percent` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `ach_id`)
);
--> statement-breakpoint
INSERT INTO `__new_achievements_stats`("app_id", "ach_id", "percent", "updated_at")
SELECT
	t.app_id,
	json_extract(value, '$.ach_id'),
	json_extract(value, '$.percent'),
	json_extract(value, '$.updated_at')
FROM
	`achievements_stats` t,
	json_each(t.data)
WHERE
	t.data IS NOT NULL
	AND json_extract(value, '$.ach_id') IS NOT NULL;--> statement-breakpoint
DROP TABLE `achievements_stats`;--> statement-breakpoint
ALTER TABLE `__new_achievements_stats` RENAME TO `achievements_stats`;--> statement-breakpoint
CREATE INDEX `idx_achievements_stats_timestamp` ON `achievements_stats` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_user_achievements_stats` (
	`user_id` text NOT NULL,
	`app_id` integer NOT NULL,
	`ach_id` text NOT NULL,
	`unlocked_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `app_id`, `ach_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO
	`__new_user_achievements_stats`(
		"user_id",
		"app_id",
		"ach_id",
		"unlocked_at",
		"updated_at"
	)
SELECT
	t.user_id,
	t.app_id,
	json_extract(value, '$.ach_id'),
	json_extract(value, '$.unlocked_at'),
	json_extract(value, '$.updated_at')
FROM
	`user_achievements_stats` t,
	json_each(t.data)
WHERE
	t.data IS NOT NULL
	AND json_extract(value, '$.ach_id') IS NOT NULL;--> statement-breakpoint
DROP TABLE `user_achievements_stats`;--> statement-breakpoint
ALTER TABLE `__new_user_achievements_stats` RENAME TO `user_achievements_stats`;--> statement-breakpoint
CREATE TABLE `__new_owned_games` (
	`user_id` text NOT NULL,
	`app_id` integer NOT NULL,
	`playtime_last_two_weeks` integer,
	`playtime_total` integer,
	`last_played_at` integer,
	PRIMARY KEY(`user_id`, `app_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO
	`__new_owned_games`(
		"user_id",
		"app_id",
		"playtime_last_two_weeks",
		"playtime_total",
		"last_played_at"
	)
SELECT
	"user_id",
	json_extract(value, '$.appid') as app_id,
	json_extract(value, '$.playtime_2weeks') as playtime_last_two_weeks,
	json_extract(value, '$.playtime_forever') as playtime_total,
	json_extract(value, '$.rtime_last_played') as last_played_at
FROM
	`owned_games`,
	json_each(`owned_games`.`data`);--> statement-breakpoint
DROP TABLE `owned_games`;--> statement-breakpoint
ALTER TABLE `__new_owned_games` RENAME TO `owned_games`;--> statement-breakpoint
DROP INDEX `idx_rare_achievements_timestamp`;--> statement-breakpoint
CREATE INDEX `idx_user_scores_timestamp` ON `user_scores` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_apps` (
	`app_id` integer NOT NULL,
	`data` text,
	`lang` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `lang`)
);
--> statement-breakpoint
INSERT INTO `__new_apps`("app_id", "data", "lang", "updated_at") SELECT "app_id", "data", "lang", "updated_at" FROM `apps`;--> statement-breakpoint
DROP TABLE `apps`;--> statement-breakpoint
ALTER TABLE `__new_apps` RENAME TO `apps`;--> statement-breakpoint
CREATE INDEX `idx_apps_timestamp` ON `apps` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_friends` (
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`friend_since` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `friend_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`friend_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO
	`__new_friends`(
		"user_id",
		"friend_id",
		"friend_since",
		"updated_at"
	)
SELECT
	f.user_id,
	json_extract(value, '$.friend_id'),
	json_extract(value, '$.friend_since'),
	json_extract(value, '$.updated_at')
FROM
	"friends" AS f,
	json_each(f.data)
WHERE
	f.data IS NOT NULL
	AND json_extract(value, '$.friend_id') IS NOT NULL;--> statement-breakpoint
DROP TABLE `friends`;--> statement-breakpoint
ALTER TABLE `__new_friends` RENAME TO `friends`;--> statement-breakpoint
CREATE INDEX `idx_friends_since` ON `friends` (`friend_since`);--> statement-breakpoint
CREATE INDEX `idx_friends_timestamp` ON `friends` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_estimated_players_timestamp` ON `estimated_players` (`updated_at`);