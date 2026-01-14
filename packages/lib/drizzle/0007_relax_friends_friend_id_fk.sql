PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_friends` (
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`friend_since` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `friend_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_friends`("user_id", "friend_id", "friend_since", "updated_at") SELECT "user_id", "friend_id", "friend_since", "updated_at" FROM `friends`;--> statement-breakpoint
DROP TABLE `friends`;--> statement-breakpoint
ALTER TABLE `__new_friends` RENAME TO `friends`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_friends_since` ON `friends` (`friend_since`);--> statement-breakpoint
CREATE INDEX `idx_friends_timestamp` ON `friends` (`updated_at`);