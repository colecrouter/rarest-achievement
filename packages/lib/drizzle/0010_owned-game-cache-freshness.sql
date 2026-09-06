ALTER TABLE `owned_games` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `owned_games` SET `updated_at` = unixepoch() WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_owned_games_timestamp` ON `owned_games` (`updated_at`);
