import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { users, ownedGames } from "../../src/repositories/sqlite/schema.js";
import { makeUserData } from "../fixtures/userData";
import { makePlayerSummariesResponse } from "../fixtures/userData";
import { runMigrations } from "../helpers/migrate";
import { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";
import { setMockOwnedGames, setMockPlayerSummaries } from "../fixtures/mockHelpers";
import { UserRepository } from "../../src/repositories/sqlite/User";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";

describe("UserRepository – SQLite (in‑memory)", () => {
    let db: ProjectDB;
    let authMock: MockSteamAuthenticatedAPIClient;

    beforeEach(async () => {
        // Fresh in‑memory DB per test case
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA foreign_keys = OFF;");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        await runMigrations(sqlite);
        db = drizzle(sqlite, { logger: true }) as unknown as ProjectDB;

        authMock = new MockSteamAuthenticatedAPIClient();
    });

    test("basic fetch inserts missing users via API", async () => {
        // No users in DB – mock API will return data for two users
        // Arrange auth mock via helpers
        setMockPlayerSummaries(
            ["123", "456"],
            makePlayerSummariesResponse(["123", "456"], {
                "123": { personaname: "Alice" },
                "456": { personaname: "Bob" },
            }),
        );

        // Minimal owned games stubs
        setMockOwnedGames(
            { steamid: "123", include_appinfo: false },
            {
                response: { game_count: 1, games: [{ appid: 1, playtime_forever: 0 }] },
            },
        );
        setMockOwnedGames(
            { steamid: "456", include_appinfo: false },
            {
                response: { game_count: 0, games: [] },
            },
        );

        const repo = new UserRepository(db, authMock);
        const result = await repo.compose().withUserIds(["123", "456"]).build();

        assert.strictEqual(result.data.length, 2, "Should return two users");
        const ids = result.data.map((u: { id: string }) => u.id).sort();
        assert.deepStrictEqual(ids, ["123", "456"]);
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

        const repo = new UserRepository(db, authMock);
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

        const repo = new UserRepository(db, authMock);
        const result = await repo.compose().build({ limit: 2, cursor: 1 });

        // With limit 2 and offset 1 we expect users 2 and 3
        assert.strictEqual(result.data.length, 2);
        const ids = result.data.map((u) => u.id);
        assert.deepStrictEqual(ids, ["u2", "u3"]);
    });

    test("error handling – API failure returns empty result", async () => {
        // Do not set player summaries for "999" so Attempt will capture the error and return empty results
        const q999: GetOwnedGamesQuery<false> = { steamid: "999", include_appinfo: false };
        const r999: GetOwnedGamesResponse<false> | null = null;
        setMockOwnedGames(q999, r999);

        const repo = new UserRepository(db, authMock);
        const result = await repo.compose().withUserIds(["999"]).build();

        // ensure no exception is thrown and result is empty
        assert.strictEqual(result.data.length, 0);
    });
});
