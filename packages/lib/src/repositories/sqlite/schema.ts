import type { DrizzleD1Database } from "drizzle-orm/d1";
import { foreignKey, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { APILanguageCode } from "../../lang";
import type { SteamAppRaw, SteamUserRaw } from "../../models";
import type { ChartDataPoint } from "../api/steamcharts/types";

export const users = sqliteTable(
	"users",
	{
		id: text("user_id").notNull().primaryKey(),
		data: text("data", { mode: "json" }).notNull().$type<SteamUserRaw>(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index("idx_users_timestamp").on(table.updated_at)],
);

export const apps = sqliteTable(
	"apps",
	{
		id: integer("app_id").notNull(),
		data: text("data", { mode: "json" }).$type<SteamAppRaw>(),
		lang: text("lang").notNull().$type<APILanguageCode>(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.id, table.lang] }), index("idx_apps_timestamp").on(table.updated_at)],
);

export const achievementsStats = sqliteTable(
	"achievements_stats",
	{
		app_id: integer("app_id").notNull(),
		// data: text("data", { mode: "json" }).$type<SteamAchievementRawGlobalStats[]>(),
		ach_id: text("ach_id").notNull(),
		percent: integer("percent").notNull(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.app_id, table.ach_id] }),
		index("idx_achievements_stats_timestamp").on(table.updated_at),
	],
);

export const achievementsMeta = sqliteTable(
	"achievements_meta",
	{
		app_id: integer("app_id").notNull(),
		lang: text("lang").notNull().$type<APILanguageCode>(),
		// data: text("data", { mode: "json" }).$type<SteamAchievementRawMeta[] | null>(),
		ach_id: text("ach_id").notNull(),
		default_value: integer("default_value").notNull(),
		display_name: text("display_name").notNull(),
		hidden: integer("hidden").notNull().default(0),
		description: text("description"),
		icon: text("icon").notNull(),
		icon_gray: text("icon_gray").notNull(),
	},
	(table) => [primaryKey({ columns: [table.app_id, table.ach_id, table.lang] })],
);

export const userAchievements = sqliteTable(
	"user_achievements_stats",
	{
		user_id: text("user_id").notNull(),
		app_id: integer("app_id").notNull(),
		ach_id: text("ach_id").notNull(),
		unlocked_at: integer("unlocked_at", { mode: "timestamp" }),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.user_id, table.app_id, table.ach_id] }),
		foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
	],
);

export const ownedGames = sqliteTable(
	"owned_games",
	{
		user_id: text("user_id").notNull(),
		app_id: integer("app_id").notNull(),
		playtime_2w_minutes: integer("playtime_last_two_weeks"),
		playtime_total_minutes: integer("playtime_total"),
		last_played_at: integer("last_played_at", { mode: "timestamp" }),
		updated_at: integer("updated_at", { mode: "timestamp" }),
	},
	(table) => [
		primaryKey({ columns: [table.user_id, table.app_id] }),
		foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
		index("idx_owned_games_timestamp").on(table.updated_at),
	],
);

export const friends = sqliteTable(
	"friends",
	{
		/** The principal user's ID */
		user_id: text("user_id").notNull(),
		/** The friend's user ID */
		friend_id: text("friend_id").notNull(),
		friend_since: integer("friend_since", { mode: "timestamp" }).notNull(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.user_id, table.friend_id] }),
		foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
		// Intentionally no FK on friend_id.
		//
		// Rationale:
		// - Our ensure flow inserts friendship edges first (cheap, avoids parameter explosion), then ensures
		//   friend user profiles via a subquery derived from friends.
		// - Enforcing FK(friend_id -> users) breaks that flow because the first insert of friendships can
		//   occur before friend profiles are present.
		// - This table is derived/cache data; integrity is enforced at query time by the ensure step.
		index("idx_friends_since").on(table.friend_since),
		index("idx_friends_timestamp").on(table.updated_at),
	],
);

export const estimatedPlayers = sqliteTable(
	"estimated_players",
	{
		app_id: integer("app_id").notNull().primaryKey(),
		estimated_players: integer("estimated_players"),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index("idx_estimated_players_timestamp").on(table.updated_at)],
);

export const steamChartsSnapshots = sqliteTable(
	"steam_charts_snapshots",
	{
		app_id: integer("app_id").notNull().primaryKey(),
		all_time_peak: integer("all_time_peak").notNull(),
		avg_count: real("avg_count").notNull(),
		day_peak: integer("day_peak").notNull(),
		recent_points: text("recent_points", { mode: "json" }).notNull().$type<ChartDataPoint[]>(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index("idx_steam_charts_snapshots_timestamp").on(table.updated_at)],
);

export const userScores = sqliteTable(
	"user_scores",
	{
		user_id: text("user_id").notNull().primaryKey(),
		rare_count: integer("rare_count").notNull(),
		updated_at: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		// Intentionally no FK to users so we can retain historical score rows
		// after the main user profile & related data is purged. This allows
		// keeping aggregate / leaderboard history without orphan delete issues.
		index("idx_user_scores_timestamp").on(table.updated_at),
	],
);

const schema = {
	users,
	apps,
	achievementsStats,
	achievementsMeta,
	userAchievements,
	ownedGames,
	friends,
	estimatedPlayers,
	steamChartsSnapshots,
	userScores,
};

export default schema;

export type ProjectDB = DrizzleD1Database<typeof schema>;
