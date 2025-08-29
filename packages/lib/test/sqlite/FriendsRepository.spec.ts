import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { GetFriendsListQuery, GetFriendsListResponse } from "../../src/repositories/api/steampowered/friends";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { friends as friendsTable, users as usersTable } from "../../src/repositories/sqlite/schema.js";

import { AttemptStatus } from "../../src/error";
import { insertFriend, insertOwnedGame } from "../fixtures/dbHelpers";
import { makeFriendsRepoWithMocks } from "../fixtures/mockHelpers";
import { makeFriendsListResponse, makePlayerSummariesResponse, makeUserData } from "../fixtures/userData";
import { runMigrations } from "../helpers/migrate";

describe("FriendsRepository - SQLite (in-memory)", () => {
    let db: ProjectDB;
    let authMock: import("../mocks/steamAuthenticated").MockSteamAuthenticatedAPIClient;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        await runMigrations(sqlite);
        // Disable FK enforcement in tests to avoid order dependencies
        sqlite.exec("PRAGMA foreign_keys = OFF;");
        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;
    });

    // Wire repo + auth for helper functions
    function getRepo() {
        const { repo, auth } = makeFriendsRepoWithMocks(db);
        authMock = auth;
        return repo;
    }

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
        const repo = getRepo();
        await seedUsers([userId]);
        setFriendsList(userId, []);

        const result = await repo.compose().withUserIds(userId).build();
        assert.strictEqual(result.data.length, 0);
    });

    test("withUserIds on multiple users without data should not throw and returns empty", async () => {
        const ids = ["u-a", "u-b"];
        const repo = getRepo();
        await seedUsers(ids);
        setFriendsList("u-a", []);
        setFriendsList("u-b", []);

        const result = await repo.compose().withUserIds(ids).build();
        assert.strictEqual(result.data.length, 0);
    });

    // 2) Data ensuring and insertion + idempotency
    test("ensureDataExists fetches via Steam API and inserts friend relationships; also ensures friend users", async () => {
        const main = "main-1";
        const fids = ["f1", "f2", "f3"];
        const repo = getRepo();

        await seedUsers([main]);
        setFriendsList(main, fids);
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 0);

        const result = await repo.compose().withUserIds(main).build();

        const rows = await db
            .select({ user_id: friendsTable.user_id, friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main));
        const insertedPairs = rows.map((r) => [r.user_id, r.friend_id] as const);
        assert.strictEqual(insertedPairs.length, fids.length, "All friendships should be inserted");

        const friendUsers = await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, fids));
        assert.strictEqual(friendUsers.length, fids.length, "All friend users must exist");

        await repo.compose().withUserIds(main).build();
        const rows2 = await db
            .select({ user_id: friendsTable.user_id, friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main));
        assert.strictEqual(rows2.length, fids.length, "No duplicate friendships after second run");

        const outIds = result.data.map((u) => u.id).sort();
        assert.deepStrictEqual(outIds, fids.slice().sort());
    });

    // 3) Sorting and pagination
    test("sorting by friend_since asc/desc and by id; pagination limits results", async () => {
        const main = "sorter";
        const fids = ["a", "b", "c"];
        const repo = getRepo();

        await seedUsers([main, ...fids]);

        const now = new Date();
        await insertFriend(db, { user_id: main, friend_id: "a", friend_since: new Date(now.getTime() - 3000) });
        await insertFriend(db, { user_id: main, friend_id: "b", friend_since: new Date(now.getTime() - 2000) });
        await insertFriend(db, { user_id: main, friend_id: "c", friend_since: new Date(now.getTime() - 1000) });

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

        const fullOrder = idAsc.data.map((u) => u.id);
        // Intentionally using non-zero cursor to validate offset behavior in this test
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
        const repo = getRepo();

        await seedUsers([main, fid1, fid2]);

        const ts1 = new Date(Date.now() - 5000);
        const ts2 = new Date(Date.now() - 4000);
        await insertFriend(db, { user_id: main, friend_id: fid1, friend_since: ts1 });
        await insertFriend(db, { user_id: main, friend_id: fid2, friend_since: ts2 });

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

        const result = await repo
            .compose()
            .withUserIds(main)
            .build({ sort: { method: "id", direction: "asc" } });

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
        const repo = getRepo();

        await seedUsers([main]);
        setFriendsList(main, fids);
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 1);

        await repo.compose().withUserIds(main).build();

        const ensured = await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, fids));
        assert.strictEqual(ensured.length, fids.length);
    });

    // 6) Edge cases
    test("duplicate friendships in API do not cause duplicates in DB or output", async () => {
        const main = "dup-main";
        const repo = getRepo();
        await seedUsers([main]);

        const dupId = "dup-friend";
        setFriendsList(main, [dupId, dupId]);
        setPlayerSummariesForUsers([dupId]);
        setOwnedGamesForUsers([dupId], 0);

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
        const repo = getRepo();

        await seedUsers([main, pre]);

        setFriendsList(main, [pre, miss]);
        setPlayerSummariesForUsers([miss]);
        setOwnedGamesForUsers([miss], 0);

        await repo.compose().withUserIds(main).build();

        const ensured = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(inArray(usersTable.id, [pre, miss]));
        assert.strictEqual(ensured.length, 2);
    });

    test("large friend lists are inserted without parameter explosion (safeInsert batching)", async () => {
        const main = "big-main";
        const repo = getRepo();
        await seedUsers([main]);

        const count = 205; // > SQL_PARAM_LIMIT to exercise batching
        const fids = Array.from({ length: count }, (_, i) => `big-f-${i + 1}`);

        setFriendsList(main, fids);
        setPlayerSummariesForUsers(fids);
        setOwnedGamesForUsers(fids, 0);

        await repo.compose().withUserIds(main).build();

        const dbPairs = await db
            .select({ friend_id: friendsTable.friend_id })
            .from(friendsTable)
            .where(eq(friendsTable.user_id, main))
            .orderBy(asc(friendsTable.friend_id));

        assert.strictEqual(dbPairs.length, count, "All friend relationships inserted without duplication");
    });
});

test("friend edge upsert is idempotent (no duplicates)", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("PRAGMA case_sensitive_like = ON;");
    sqlite.exec("PRAGMA journal_mode = WAL;");
    sqlite.exec("PRAGMA synchronous = NORMAL;");
    await runMigrations(sqlite);
    // Foreign keys disabled in this suite's setup pattern; keep consistent
    sqlite.exec("PRAGMA foreign_keys = OFF;");
    const db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

    const userId = "upsert-main";
    const friendId = "upsert-friend";

    // Seed initial row with controlled timestamps
    const t0 = new Date(Date.now() - 60_000);
    await db.insert(friendsTable).values({
        user_id: userId,
        friend_id: friendId,
        friend_since: t0,
        updated_at: t0,
    });

    // Attempt to "upsert" the same PK with later timestamps.
    // FriendsRepository uses onConflictDoNothing(), so duplicates should not be created
    // and updated_at should NOT change.
    const t1 = new Date();
    await db
        .insert(friendsTable)
        .values({
            user_id: userId,
            friend_id: friendId,
            friend_since: t1,
            updated_at: t1,
        })
        .onConflictDoNothing();

    const rows = await db
        .select({
            user_id: friendsTable.user_id,
            friend_id: friendsTable.friend_id,
            friend_since: friendsTable.friend_since,
            updated_at: friendsTable.updated_at,
        })
        .from(friendsTable)
        .where(eq(friendsTable.user_id, userId));

    assert.strictEqual(rows.length, 1, "duplicate insert must not create multiple rows");
    const row = rows[0];
    if (!row) throw new Error("expected one friendship row after upsert attempt");
    assert.strictEqual(row.friend_id, friendId);
    // Since conflict-do-nothing is used, original values should remain unchanged (compare at second precision)
    assert.strictEqual(
        Math.floor(row.friend_since.getTime() / 1000),
        Math.floor(t0.getTime() / 1000),
        "friend_since should remain unchanged on conflict",
    );
    assert.strictEqual(
        Math.floor(row.updated_at.getTime() / 1000),
        Math.floor(t0.getTime() / 1000),
        "updated_at should remain unchanged on conflict with do-nothing",
    );
});

import { describe as describe_count_friends, test as test_count_friends } from "node:test";

describe_count_friends("FriendsRepository.count()", () => {
    test_count_friends("parity: withUserIds equals build length for seeded friendships", async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");
        await runMigrations(sqlite);
        const db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

        const { repo } = makeFriendsRepoWithMocks(db);

        const main = "main-count";
        const fids = ["fc1", "fc2", "fc3"];

        // Seed users and friendships directly
        for (const id of [main, ...fids]) {
            await db.insert(usersTable).values({ id, data: makeUserData(id), updated_at: new Date() });
        }
        const now = new Date();
        for (const [i, fid] of fids.entries()) {
            await insertFriend(db, {
                user_id: main,
                friend_id: fid,
                friend_since: new Date(now.getTime() - (i + 1) * 1000),
            });
        }

        const buildRes = await repo.compose().withUserIds(main).build();
        const countAttempt = await repo.compose().withUserIds(main).count();

        assert.strictEqual(countAttempt.status, AttemptStatus.Ok);
        assert.strictEqual(countAttempt.data, buildRes.data.length);
    });

    test_count_friends("empty scope: no userIds -> count returns Ok(0)", async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");
        await runMigrations(sqlite);
        const db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

        const { repo } = makeFriendsRepoWithMocks(db);

        const attempt = await repo.compose().count();
        assert.strictEqual(attempt.status, AttemptStatus.Ok);
        assert.strictEqual(attempt.data, 0);
    });

    test_count_friends("error propagation: COUNT failure => AttemptStatus.Failure", async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");
        await runMigrations(sqlite);
        const db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

        const { repo } = makeFriendsRepoWithMocks(db);

        const main = "boom-main";
        const fid = "boom-friend";

        await db.insert(usersTable).values({ id: main, data: makeUserData(main), updated_at: new Date() });
        await db.insert(usersTable).values({ id: fid, data: makeUserData(fid), updated_at: new Date() });
        await insertFriend(db, { user_id: main, friend_id: fid, friend_since: new Date() });

        const composer = repo.compose().withUserIds(main);

        // Drop table to force COUNT failure
        sqlite.exec("DROP TABLE friends;");

        const attempt = await composer.count();

        assert.strictEqual(attempt.status, AttemptStatus.Failure);
        assert.ok(attempt.error);
    });
});
