import { SteamApp, SteamAppAchievement, SteamUserAchievement } from "@project/lib";

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
				const { app: _, ...rest } = a.serialize();
				return rest as Omit<Params<T>[0], "app">;
			});

			return [app.serialize(), params] as const;
		});

		return a;
	}

	public decodeAppAchievements(value: ReturnType<typeof this.encode>) {
		const apps: SteamAppAchievement[] = [];

		for (const [appParams, achievements] of value) {
			if (!appParams) continue;
			const app = new SteamApp(appParams);
			for (const params of achievements) {
				const achievement = new SteamAppAchievement({ app, ...params });
				apps.push(achievement);
			}
		}

		return apps;
	}

	public decodeUserAchievements(value: ReturnType<AchievementArrayContext<SteamUserAchievement>["encode"]>) {
		const apps: SteamUserAchievement[] = [];

		for (const [appParams, achievements] of value) {
			const app = new SteamApp(appParams);
			for (const params of achievements) {
				const { user, userStats } = params;
				// Don't check for truthiness of userStats! It can be null
				// I made that mistake before...
				if (!user || userStats === undefined) continue;
				const achievement = new SteamUserAchievement({
					app,
					...params,
				});
				apps.push(achievement);
			}
		}

		return apps;
	}
}
