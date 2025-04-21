CREATE TABLE `estimated_players` (
	`app_id` integer PRIMARY KEY NOT NULL,
	`estimated_players` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `apps` DROP COLUMN `estimated_players`;