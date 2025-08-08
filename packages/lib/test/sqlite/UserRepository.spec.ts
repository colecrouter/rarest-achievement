import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { ownedGames, users } from "../../src/repositories/sqlite/schema.js";
import { makeUserRepoWithMocks } from "../fixtures/mockHelpers";
import { makeUserData } from "../fixtures/userData";
import { runMigrations } from "../helpers/migrate";
import type { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";

describe("UserRepository - SQLite (in-memory)", () => {
    let db: ProjectDB;
    let authMock: MockSteamAuthenticatedAPIClient;

    beforeEach(async () => {
        // Fresh in-memory DB per test case
        const sqlite = new Database(":memory:");
        // Align sqlite behavior
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        await runMigrations(sqlite);
        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;
    });

    function getRepo() {
        const { repo, auth } = makeUserRepoWithMocks(db);
        authMock = auth;
        return repo;
    }

    test("basic fetch inserts missing users via API", async () => {
        const repo = getRepo();
        // No users in DB – mock API will return data for two users
        const ps: GetPlayerSummariesResponse = {
            response: {
                players: [makeUserData("123"), makeUserData("456")],
            },
        };
        authMock.setPlayerSummaries(["123", "456"], ps);

        // Minimal owned games stubs aligned with repository's call signature
        const q123: GetOwnedGamesQuery<false> = { steamid: "123", include_played_free_games: true };
        const r123: GetOwnedGamesResponse<false> = {
            response: { game_count: 1, games: [{ appid: 1, playtime_forever: 0 }] },
        };
        authMock.setOwnedGames(q123, r123);

        const q456: GetOwnedGamesQuery<false> = { steamid: "456", include_played_free_games: true };
        const r456: GetOwnedGamesResponse<false> = {
            response: { game_count: 0, games: [] },
        };
        authMock.setOwnedGames(q456, r456);

        const result = await repo.compose().withUserIds(["123", "456"]).build();

        assert.strictEqual(result.data.length, 2, "Should return two users");
        const ids = result.data.map((u) => u.id).sort();
        assert.deepStrictEqual(ids, ["123", "456"]);
    });

    test("returns cached users without API", async () => {
        // Seed users directly without setting any API mocks
        await db.insert(users).values({
            id: "777",
            data: makeUserData("777"),
            updated_at: new Date(),
        });
        await db.insert(users).values({
            id: "888",
            data: makeUserData("888"),
            updated_at: new Date(),
        });

        const repo = getRepo();
        const result = await repo.compose().withUserIds(["777", "888"]).build();

        assert.strictEqual(result.data.length, 2, "Should return cached users without API");
        const ids = result.data.map((u) => u.id).sort();
        assert.deepStrictEqual(ids, ["777", "888"]);
    });

    test("filter by explicit user IDs", async () => {
        await db.insert(users).values({
            id: "111",
            data: makeUserData("111"),
            updated_at: new Date(),
        });
        await db.insert(users).values({
            id: "222",
            data: makeUserData("222"),
            updated_at: new Date(),
        });
        await db.insert(ownedGames).values({
            user_id: "111",
            app_id: 10,
            playtime_2w_minutes: 0,
            playtime_total_minutes: 0,
            last_played_at: null,
        });

        const repo = getRepo();
        const result = await repo.compose().withUserIds(["111"]).build();

        assert.strictEqual(result.data.length, 1, "Only one user should be returned");
        assert.strictEqual(result.data[0]?.id, "111");
    });

    test("pagination works (limit/offset)", async () => {
        // Insert three users
        await db.insert(users).values({
            id: "u1",
            data: makeUserData("u1"),
            updated_at: new Date(),
        });
        await db.insert(users).values({
            id: "u2",
            data: makeUserData("u2"),
            updated_at: new Date(),
        });
        await db.insert(users).values({
            id: "u3",
            data: makeUserData("u3"),
            updated_at: new Date(),
        });

        const repo = getRepo();
        // Intentionally using non-zero cursor to validate offset behavior in this test
        const result = await repo.compose().build({ limit: 2, cursor: 1 });

        // With limit 2 and offset 1 we expect users 2 and 3
        assert.strictEqual(result.data.length, 2);
        const ids = result.data.map((u) => u.id);
        assert.deepStrictEqual(ids, ["u2", "u3"]);
    });

    test("error handling – API failure returns empty result", async () => {
        const repo = getRepo();
        // Do not set player summaries for "999" so Attempt will capture the error and return empty results
        const q999: GetOwnedGamesQuery<false> = { steamid: "999", include_played_free_games: true };
        const r999: GetOwnedGamesResponse<false> | null = null;
        authMock.setOwnedGames(q999, r999);

        const result = await repo.compose().withUserIds(["999"]).build();

        // ensure no exception is thrown and result is empty
        assert.strictEqual(result.data.length, 0);
    });
});
