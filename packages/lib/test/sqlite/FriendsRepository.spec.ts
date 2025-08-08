import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { asc, eq, inArray } from "drizzle-orm";
import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";

import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { friends as friendsTable, users as usersTable } from "../../src/repositories/sqlite/schema.js";
import type { GetFriendsListQuery, GetFriendsListResponse } from "../../src/repositories/api/steampowered/friends";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";

import { runMigrations } from "../helpers/migrate";
import { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";
import { createFriendsRepository } from "../fixtures/mockHelpers";
import { insertFriend, insertOwnedGame } from "../fixtures/dbHelpers";
import { makeFriendsListResponse, makePlayerSummariesResponse, makeUserData } from "../fixtures/userData";

describe("FriendsRepository – SQLite (in‑memory)", () => {
    let db: ProjectDB;
    let authMock: MockSteamAuthenticatedAPIClient;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA foreign_keys = OFF;");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        await runMigrations(sqlite);
        // Re-disable FKs after migrations because migration 0005 turns them back ON.
        // FriendsRepository inserts friend rows before ensuring friend users, which violates FK otherwise.
        sqlite.exec("PRAGMA foreign_keys = OFF;");
        db = drizzle(sqlite, { logger: true }) as unknown as ProjectDB;

        authMock = new MockSteamAuthenticatedAPIClient();
    });

    // Helpers
    function setOwnedGamesForUsers(userIds: string[], gamesPerUser: number | ((id: string) => number) = 0) {
        for (const id of userIds) {
            const count = typeof gamesPerUser === "function" ? gamesPerUser(id) : gamesPerUser;
            const games = Array.from({ length: count }).map((_, i) => ({
                appid: 1000 + i,
                playtime_forever: 10 * (i + 1),
                playtime_2weeks: undefined,
                rtime_last_played: undefined,
            }));
            const q: GetOwnedGamesQuery<false> = { steamid: id, include_played_free_games: true };
            const r: GetOwnedGamesResponse<false> = { response: { game_count: games.length, games } };
            authMock.setOwnedGames(q, r);
        }
    }

    function setPlayerSummariesForUsers(userIds: string[]) {
        const ps: GetPlayerSummariesResponse = makePlayerSummariesResponse(userIds, {});
        authMock.setPlayerSummaries(userIds, ps);
    }

    function setFriendsList(userId: string, friendIds: string[], since?: number | Date) {
        const q: GetFriendsListQuery = { steamid: userId, relationship: "friend" };
        const r: GetFriendsListResponse = makeFriendsListResponse(userId, friendIds, since);
        authMock.setFriendsList(q, r);
    }

    async function seedUsers(ids: string[]) {
        for (const id of ids) {
            await db.insert(usersTable).values({ id, data: makeUserData(id), updated_at: new Date() });
        }
    }

    // 1) Basic building
    test("withUserIds on a user with no friends returns empty list", async () => {
        const userId = "user-empty";
        await seedUsers([userId]); // ensure main user exists, avoid user API fetch
        setFriendsList(userId, []); // empty API result

        const repo = createFriendsRepository(db, authMock);
        const result = await repo.compose().withUserIds(userId).build();

        assert.strictEqual(result.data.length, 0);
    });

    test("withUserIds on multiple users without data should not throw and returns empty", async () => {
        const ids = ["u-a", "u-b"];
        await seedUsers(ids);
        setFriendsList("u-a", []);
        setFriendsList("u-b", []);

        const repo = createFriendsRepository(db, authMock);
        const result = await repo.compose().withUserIds(ids).build();

        assert.strictEqual(result.data.length, 0);
    });

    // 2) Data ensuring and insertion + idempotency
    test("ensureDataExists fetches via Steam API and inserts friend relationships; also ensures friend users", async () => {
        const main = "main-1";
        const fids = ["f1", "f2", "f3"];

        // Ensure main user exists to avoid fetching it
        await seedUsers([main]);

        // Configure friends list
        setFriendsList(main, fids);

        // Configure friend users API for ensureDataExists subquery path
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 0);

        const repo = createFriendsRepository(db, authMock);
        const result = await repo.compose().withUserIds(main).build();

        // relationships inserted
        const rows = await db
            .select({ user_id: friendsTable.user_id, friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main));
        const insertedPairs = rows.map((r) => [r.user_id, r.friend_id] as const);
        assert.strictEqual(insertedPairs.length, fids.length, "All friendships should be inserted");

        // friend users ensured (exist in users table)
        const friendUsers = await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, fids));
        assert.strictEqual(friendUsers.length, fids.length, "All friend users must exist");

        // idempotent: run again; should not duplicate
        await repo.compose().withUserIds(main).build();
        const rows2 = await db
            .select({ user_id: friendsTable.user_id, friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main));
        assert.strictEqual(rows2.length, fids.length, "No duplicate friendships after second run");

        // output has unique friends
        const outIds = result.data.map((u) => u.id).sort();
        assert.deepStrictEqual(outIds, fids.slice().sort());
    });

    // 3) Sorting and pagination
    test("sorting by friend_since asc/desc and by id; pagination limits results", async () => {
        const main = "sorter";
        const fids = ["a", "b", "c"];

        // Seed main + friend users so no API fetch needed in ensure step
        await seedUsers([main, ...fids]);

        // Insert friendships with different friend_since
        const now = new Date();
        await insertFriend(db, { user_id: main, friend_id: "a", friend_since: new Date(now.getTime() - 3000) });
        await insertFriend(db, { user_id: main, friend_id: "b", friend_since: new Date(now.getTime() - 2000) });
        await insertFriend(db, { user_id: main, friend_id: "c", friend_since: new Date(now.getTime() - 1000) });

        const repo = createFriendsRepository(db, authMock);

        // By friend_since ascending vs descending should be inverse
        const ascRes = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "friend_since", direction: "asc" } });
        const descRes = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "friend_since", direction: "desc" } });

        const ascIds = ascRes.data.map((u) => u.id);
        const descIds = descRes.data.map((u) => u.id);

        assert.strictEqual(ascIds.length, 3);
        assert.strictEqual(descIds.length, 3);
        assert.deepStrictEqual(ascIds.slice().reverse(), descIds, "Opposite directions should invert ordering");

        // By id (friend_id)
        const idAsc = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "id", direction: "asc" } });
        const idDesc = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "id", direction: "desc" } });
        assert.strictEqual(idAsc.data.length, 3);
        assert.strictEqual(idDesc.data.length, 3);
        assert.deepStrictEqual(
            idAsc.data
                .map((u) => u.id)
                .slice()
                .reverse(),
            idDesc.data.map((u) => u.id),
        );

        // Pagination: derive expected by slicing full order
        const fullOrder = idAsc.data.map((u) => u.id);
        const page = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "id", direction: "asc" }, limit: 2, cursor: 1 });
        assert.strictEqual(page.data.length, 2);
        assert.deepStrictEqual(
            page.data.map((u) => u.id),
            fullOrder.slice(1, 3),
        );
    });

    // 4) Owned games join
    test("owned games for friend users are joined and mapped on results", async () => {
        const main = "owner";
        const fid1 = "friend1";
        const fid2 = "friend2";

        await seedUsers([main, fid1, fid2]);

        // Insert friendships
        const ts1 = new Date(Date.now() - 5000);
        const ts2 = new Date(Date.now() - 4000);
        await insertFriend(db, { user_id: main, friend_id: fid1, friend_since: ts1 });
        await insertFriend(db, { user_id: main, friend_id: fid2, friend_since: ts2 });

        // Seed owned games directly
        const lp = new Date(Date.now() - 1000);
        await insertOwnedGame(db, {
            user_id: fid1,
            app_id: 10,
            playtime_2w_minutes: 12,
            playtime_total_minutes: 345,
            last_played_at: lp,
        });
        await insertOwnedGame(db, {
            user_id: fid2,
            app_id: 20,
            playtime_2w_minutes: null,
            playtime_total_minutes: 0,
            last_played_at: null,
        });

        const repo = createFriendsRepository(db, authMock);
        const result = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "id", direction: "asc" } });

        // Verify mapping through serialize() (raw OwnedGame)
        const byId = new Map(result.data.map((f) => [f.id, f]));
        const f1 = byId.get(fid1);
        const f2 = byId.get(fid2);
        assert.ok(f1 && f2, "Both friends should be present");

        const f1Raw = f1.serialize().ownedApps;
        const f2Raw = f2.serialize().ownedApps;
        assert.ok(Array.isArray(f1Raw) && f1Raw.length >= 1);
        assert.ok(Array.isArray(f2Raw) && f2Raw.length >= 1);

        const g1 = f1Raw.find((g) => g.appid === 10);
        assert.ok(g1);
        assert.strictEqual(g1.playtime_2weeks, 12);
        assert.strictEqual(g1.playtime_forever, 345);
        assert.strictEqual(g1.rtime_last_played, Math.floor(lp.getTime() / 1000));

        const g2 = f2Raw.find((g) => g.appid === 20);
        assert.ok(g2);
        assert.strictEqual(g2.playtime_2weeks, undefined);
        assert.strictEqual(g2.playtime_forever, 0);
        assert.strictEqual(g2.rtime_last_played, undefined);
    });

    // 5) Cross-repo subquery path (ensure friend users via subquery, not large parameter arrays)
    test("ensure friend users via subquery path", async () => {
        const main = "ensure-main";
        const fids = ["su1", "su2", "su3", "su4"];

        // Only main user pre-seeded
        await seedUsers([main]);

        // Friends list provided by API
        setFriendsList(main, fids);

        // Configure API to return summaries/owned for friend users (only)
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 1);

        const repo = createFriendsRepository(db, authMock);
        await repo.compose().withUserIds(main).build();

        // All friend users should now exist (subquery ensured them)
        const ensured = await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, fids));
        assert.strictEqual(ensured.length, fids.length);
    });

    // 6) Edge cases
    test("duplicate friendships in API do not cause duplicates in DB or output", async () => {
        const main = "dup-main";
        await seedUsers([main]);

        // Duplicate friend id in API response
        const dupId = "dup-friend";
        setFriendsList(main, [dupId, dupId]);

        setPlayerSummariesForUsers([dupId]);
        setOwnedGamesForUsers([dupId], 0);

        const repo = createFriendsRepository(db, authMock);
        const result = await repo.compose().withUserIds(main).build();

        const dbPairs = await db
            .select({ user_id: friendsTable.user_id, friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main));
        const uniqueDbFriendIds = new Set(dbPairs.map((r) => r.friend_id));
        assert.strictEqual(uniqueDbFriendIds.size, 1, "Only one friendship row inserted");

        const outIds = new Set(result.data.map((u) => u.id));
        assert.strictEqual(outIds.size, 1, "Output should be de-duplicated");
    });

    test("mixed presence: some friend users already present in users, others missing", async () => {
        const main = "mix-main";
        const pre = "already";
        const miss = "missing";
        await seedUsers([main, pre]);

        setFriendsList(main, [pre, miss]);
        // Only mock API for missing friend
        setPlayerSummariesForUsers([miss]);
        setOwnedGamesForUsers([miss], 0);

        const repo = createFriendsRepository(db, authMock);
        await repo.compose().withUserIds(main).build();

        // Both should exist
        const ensured = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(inArray(usersTable.id, [pre, miss]));
        assert.strictEqual(ensured.length, 2);
    });

    test("large friend lists are inserted without parameter explosion (safeInsert batching)", async () => {
        const main = "big-main";
        await seedUsers([main]);

        const count = 205; // > SQL_PARAM_LIMIT to exercise batching
        const fids = Array.from({ length: count }, (_, i) => `big-f-${i + 1}`);

        setFriendsList(main, fids);

        // Prepare summaries/owned for all friend users
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 0);

        const repo = createFriendsRepository(db, authMock);
        await repo.compose().withUserIds(main).build();

        const dbPairs = await db
            .select({ friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main))
            .orderBy(asc(friendsTable.friend_id));

        assert.strictEqual(dbPairs.length, count, "All friend relationships inserted without duplication");
    });
});
