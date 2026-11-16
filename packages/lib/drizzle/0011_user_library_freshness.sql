ALTER TABLE `users` ADD `owned_games_updated_at` integer;
--> statement-breakpoint
-- Preserve freshness for libraries already stored before the cache was split.
UPDATE users
SET owned_games_updated_at = (
    SELECT MAX(owned_games.updated_at)
    FROM owned_games
    WHERE owned_games.user_id = users.user_id
);
