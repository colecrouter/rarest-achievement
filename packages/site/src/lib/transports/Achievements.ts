import { SteamApp, SteamAppAchievement, SteamUserAchievement } from "@project/lib";

type RemoveFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

type Params<T> = ConstructorParameters<
    T extends SteamUserAchievement ? typeof SteamUserAchievement : typeof SteamAppAchievement
>;

/**
 * A context for encoding and decoding arrays of achievements.
 * Encoding Achievements is too inefficient because each achievement holds a reference to the app,
 * which is already encoded. So we need to encode the app separately.
 */
export class AchievementArrayContext<T extends SteamAppAchievement | SteamUserAchievement> {
    public static isAppAchievementArray(obj: unknown): obj is SteamAppAchievement[] {
        if (!Array.isArray(obj)) return false;
        if (obj.length === 0) return false;
        if (!obj.every((o) => o instanceof SteamAppAchievement)) return false;

        return true;
    }

    public static isUserAchievementArray(obj: unknown): obj is SteamUserAchievement[] {
        if (!Array.isArray(obj)) return false;
        if (obj.length === 0) return false;
        if (!obj.every((o) => o instanceof SteamUserAchievement)) return false;

        return true;
    }

    public encode(value: T[]) {
        if (value.length === 0) return [] as const;

        const apps = new Map<SteamApp, T[]>();

        for (const v of value) {
            if (!apps.has(v.app)) {
                apps.set(v.app, []);
            }
            apps.get(v.app)?.push(v);
        }

        // Return record where value is ConstructorParams<T> MINUS the first element (the app)
        const a = [...apps.entries()].map(([app, achievements]) => {
            const params = achievements.map((a) => {
                const [, ...params] = a instanceof SteamUserAchievement ? a.serializeUser() : a.serialize();
                return params as RemoveFirst<Params<T>>;
            });

            return [app.serialize(), params] as const;
        });

        return a;
    }

    public decodeAppAchievements(value: ReturnType<typeof this.encode>) {
        const apps = new Array<SteamAppAchievement>();

        for (const [appParams, achievements] of value) {
            if (!appParams) continue;
            const [id, details, players] = appParams;
            const app = new SteamApp(id, details, players);
            for (const params of achievements) {
                const [meta, global, lang] = params;
                const achievement = new SteamAppAchievement(app, meta, global, lang);
                apps.push(achievement);
            }
        }

        return apps;
    }

    public decodeUserAchievements(value: ReturnType<typeof this.encode>) {
        const apps = new Array<SteamUserAchievement>();

        for (const [appParams, achievements] of value) {
            const [id, details, players] = appParams;
            const app = new SteamApp(id, details, players);
            for (const params of achievements) {
                const [meta, global, lang, steamid, userStats] = params;
                if (!userStats || !steamid) continue;
                const achievement = new SteamUserAchievement(app, meta, global, lang, steamid, userStats);
                apps.push(achievement);
            }
        }
        return apps;
    }
}
