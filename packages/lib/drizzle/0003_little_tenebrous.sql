CREATE TABLE `user_scores` (
	`user_id` text PRIMARY KEY NOT NULL,
	`rare_count` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rare_achievements_timestamp` ON `user_scores` (`updated_at`);