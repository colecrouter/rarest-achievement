import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { APILanguageCode } from "../../index";
import type { LanguageCode } from "../../lang";
import { getLanguageByCode } from "../../lang";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import { createQueryResult } from "../composable";
import { RepositoryResult } from "../repository";
import { AppRepository } from "./App";
import { AppAchievementRepository } from "./AppAchievement";
import { FriendsRepository } from "./Friends";
import { UserRepository } from "./User";
import { UserAchievementRepository } from "./UserAchievement";

export class VaultService {
    private appRepo: AppRepository;
    private appAchRepo: AppAchievementRepository;
    private userRepo: UserRepository;
    private userAchRepo: UserAchievementRepository;
    private friendRepo: FriendsRepository;

    // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
    constructor(sqlite: DrizzleD1Database<any>, steamApi: SteamAuthenticatedAPIClient) {
        this.appRepo = new AppRepository(sqlite, steamApi);
        this.appAchRepo = new AppAchievementRepository(sqlite, this.appRepo);
        this.userRepo = new UserRepository(sqlite, steamApi);
        this.friendRepo = new FriendsRepository(sqlite, steamApi, this.userRepo);
        this.userAchRepo = new UserAchievementRepository(
            sqlite,
            steamApi,
            this.appAchRepo,
            this.userRepo,
            this.friendRepo,
            this.appRepo,
        );
    }

    // Composable methods that avoid parameter explosion
    /**
     * Get apps owned by friends of a specific user - demonstrates cross-repository composition
     */
    async getAppsOwnedByFriends(params: {
        userId: string;
        withAchievements?: boolean;
        search?: string;
        limit?: number;
        cursor?: number;
        lang: LanguageCode;
    }) {
        console.log(`🎮 Getting apps owned by friends of user ${params.userId}`);

        // First get friends using composable query
        const friendsResult = await this.friendRepo
            .compose()
            .withUserIds(params.userId)
            .build({
                sort: { method: "id", direction: "asc" },
            });

        if (!friendsResult.data?.length) {
            console.log("No friends found");
            return new RepositoryResult([], 0, friendsResult.error);
        }

        const friendIds = friendsResult.data.map((friend) => friend.id);
        console.log(`👥 Found ${friendIds.length} friends`);

        let composer = this.appRepo.compose().withLanguage(params.lang).withOwnedByUsers(friendIds);

        if (params.withAchievements) {
            composer = composer.withAchievements();
        }

        if (params.search) {
            composer = composer.withSearch(params.search);
        }

        const results = await composer.build({
            cursor: params.cursor,
            limit: params.limit,
            sort: { method: "id", direction: "asc" },
        });

        console.log(`✅ Found ${results.data?.length || 0} apps for user ${params.userId}`);
        return new RepositoryResult(results.data || [], results.cursor, results.error);
    }

    /**
     * Get user achievements with unlocked filtering - demonstrates batched processing
     */
    async getUserAchievementsWithUnlockedFilter(params: {
        userIds: string[];
        appIds?: number[];
        achievementIds?: string[];
        unlocked?: boolean;
        search?: string;
        limit?: number;
        cursor?: number;
        lang: LanguageCode;
    }) {
        console.log(`🏆 Getting user achievements for ${params.userIds.length} users (unlocked: ${params.unlocked})`);

        // Use composable query with batched processing for unlocked filtering
        let composer = this.userAchRepo
            .compose()
            .withLanguage(params.lang)
            .withUserIds(params.userIds)
            .withUnlockedStatus(params.unlocked);

        if (params.appIds && params.appIds.length > 0) {
            composer = composer.withAppIds(params.appIds);
        }

        if (params.achievementIds && params.achievementIds.length > 0) {
            composer = composer.withAchievementIds(params.achievementIds);
        }

        if (params.search) {
            composer = composer.withSearch(params.search);
        }

        const results = await composer.build({
            cursor: params.cursor,
            limit: params.limit,
            sort: { method: "rarity_pct", direction: "asc" },
        });

        console.log(`✅ Found ${results.data?.length || 0} user achievements`);
        return new RepositoryResult(results.data || [], results.cursor, results.error);
    }

    /**
     * Get popular apps with achievements - demonstrates app filtering composition
     */
    async getPopularAppsWithAchievements(params: {
        appIds?: number[];
        search?: string;
        limit?: number;
        cursor?: number;
        lang: LanguageCode;
    }) {
        console.log("🏆 Getting popular apps with achievements");

        let composer = this.appRepo.compose().withLanguage(params.lang).withAchievements(); // Only apps that have achievements

        if (params.appIds?.length) {
            composer = composer.withAppIds(params.appIds);
        }

        if (params.search) {
            composer = composer.withSearch(params.search);
        }

        const results = await composer.build({
            cursor: params.cursor,
            limit: params.limit,
            sort: { method: "id", direction: "asc" },
        });

        console.log(`✅ Found ${results.data?.length || 0} popular apps with achievements`);
        return new RepositoryResult(results.data || [], results.cursor, results.error);
    }

    /**
     * Get apps by specific IDs with full data - efficient batching
     */
    async getAppsWithFullData(params: { appIds: number[]; lang: LanguageCode }) {
        console.log(`📱 Getting ${params.appIds.length} apps with full data`);

        const composer = this.appRepo.compose().withLanguage(params.lang).withAppIds(params.appIds);

        const results = await composer.build({
            sort: { method: "id", direction: "asc" },
        });

        console.log(`✅ Retrieved ${results.data.length} apps with full data`);
        return createQueryResult(results.data, results.cursor, results.error);
    }

    /**
     * Get rare achievements for specific apps - demonstrates achievement filtering composition
     */
    async getRareAchievementsForApps(params: {
        appIds: number[];
        maxRarityPercent?: number;
        search?: string;
        limit?: number;
        cursor?: number;
        lang: LanguageCode;
    }) {
        console.log(`🏆 Getting rare achievements for ${params.appIds.length} apps`);

        // Use composable query for achievements
        let composer = this.appAchRepo
            .compose()
            .withLanguage(params.lang)
            .withAppIds(params.appIds)
            .withRarityThreshold(params.maxRarityPercent || 0.1); // Default to achievements with <10% unlock rate

        // Add search if provided
        if (params.search) {
            composer = composer.withSearch(params.search);
        }

        const results = await composer.build({
            cursor: params.cursor,
            limit: params.limit,
            sort: { method: "rarity_pct", direction: "asc" }, // Rarest first
        });

        console.log(`✅ Found ${results.data?.length || 0} rare achievements`);
        return new RepositoryResult(results.data || [], results.cursor, results.error);
    }

    /**
     * Get users by IDs with their owned games - composable approach
     */
    async getUsersWithOwnedGames(params: {
        userIds: string[];
        limit?: number;
        cursor?: number;
        lang: LanguageCode;
    }) {
        console.log(`👤 Getting users: ${params.userIds.join(", ")}`);

        const results = await this.users
            .compose()
            .withUserIds(params.userIds)
            .build({
                cursor: params.cursor,
                limit: params.limit,
                sort: { method: "id", direction: "asc" },
            });

        console.log(`✅ Retrieved ${results.data?.length || 0} users with owned games`);
        return new RepositoryResult(results.data || [], results.cursor, results.error);
    }

    /**
     * Direct access to composable app achievement queries
     */
    get appAchievements() {
        return this.appAchRepo;
    }

    /**
     * Direct access to composable app queries
     */
    get apps() {
        return this.appRepo;
    }

    /**
     * Direct access to composable user queries
     */
    get users() {
        return this.userRepo;
    }

    /**
     * Direct access to composable friends queries
     */
    get friends() {
        return this.friendRepo;
    }

    /**
     * Direct access to composable user achievement queries
     */
    get userAchievements() {
        return this.userAchRepo;
    }
}

export type * from "./App";
export type * from "./AppAchievement";
export type * from "./Friends";
export type * from "./User";
export type * from "./UserAchievement";
