PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_scores` (
	`user_id` text PRIMARY KEY NOT NULL,
	`rare_count` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_scores`("user_id", "rare_count", "updated_at") SELECT "user_id", "rare_count", "updated_at" FROM `user_scores`;--> statement-breakpoint
DROP TABLE `user_scores`;--> statement-breakpoint
ALTER TABLE `__new_user_scores` RENAME TO `user_scores`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_user_scores_timestamp` ON `user_scores` (`updated_at`);