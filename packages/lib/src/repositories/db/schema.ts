import { foreignKey, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
    SteamAchievementRawGlobalStats,
    SteamAchievementRawMeta,
    SteamAppRaw,
    SteamFriendsListRaw,
    SteamUserAchievementRawStats,
    SteamUserRaw,
} from "../../models";
import type { OwnedGame } from "../api/steampowered/owned";
import type { DrizzleD1Database } from "drizzle-orm/d1";

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
        id: integer("app_id").notNull().primaryKey(),
        data: text("data", { mode: "json" }).$type<SteamAppRaw>(),
        updated_at: integer("updated_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [index("idx_apps_timestamp").on(table.updated_at)],
);

export const achievementsStats = sqliteTable(
    "achievements_stats",
    {
        app_id: integer("app_id").notNull().primaryKey(),
        data: text("data", { mode: "json" }).$type<SteamAchievementRawGlobalStats[]>(),
        updated_at: integer("updated_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        foreignKey({ columns: [table.app_id], foreignColumns: [apps.id] }),
        index("idx_achievements_stats_timestamp").on(table.updated_at),
    ],
);

export const achievementsMeta = sqliteTable(
    "achievements_meta",
    {
        app_id: integer("app_id").notNull(),
        lang: text("lang").notNull(),
        data: text("data", { mode: "json" }).$type<SteamAchievementRawMeta[]>(),
        updated_at: integer("updated_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        primaryKey({ columns: [table.app_id, table.lang] }),
        foreignKey({ columns: [table.app_id], foreignColumns: [apps.id] }),
        index("idx_achievements_meta_timestamp").on(table.updated_at),
    ],
);

export const userAchievements = sqliteTable(
    "user_achievements_stats",
    {
        user_id: text("user_id").notNull(),
        app_id: integer("app_id").notNull(),
        data: text("data", { mode: "json" }).$type<SteamUserAchievementRawStats[]>(),
        updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    },
    (table) => [
        primaryKey({ columns: [table.user_id, table.app_id] }),
        foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
        foreignKey({ columns: [table.app_id], foreignColumns: [apps.id] }),
        index("idx_user_achievements_timestamp").on(table.updated_at),
    ],
);

export const ownedGames = sqliteTable(
    "owned_games",
    {
        user_id: text("user_id").notNull().primaryKey(),
        data: text("data", { mode: "json" }).notNull().$type<OwnedGame<false>[]>(),
        updated_at: integer("updated_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
        index("idx_owned_games_timestamp").on(table.updated_at),
    ],
);

export const friends = sqliteTable(
    "friends",
    {
        user_id: text("user_id").notNull().primaryKey(),
        data: text("data", { mode: "json" }).notNull().$type<SteamFriendsListRaw>(),
        updated_at: integer("updated_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
        index("idx_friends_timestamp").on(table.updated_at),
    ],
);

export const estimatedPlayers = sqliteTable("estimated_players", {
    app_id: integer("app_id").notNull().primaryKey(),
    estimated_players: integer("estimated_players"),
    updated_at: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

const schema = {
    users,
    apps,
    achievementsStats,
    achievementsMeta,
    userAchievements,
    ownedGames,
    friends,
    estimatedPlayers,
};

export default schema;

export type ProjectDB = DrizzleD1Database<typeof schema>;
