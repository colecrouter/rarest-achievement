import { i18n } from "$lib/i18n";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamUser } from "$lib/steam/data/SteamUser";
import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";
import type { Transport } from "@sveltejs/kit";
export const reroute = i18n.reroute();

export const transport: Transport = {
    SteamUser: {
        encode: (data) => data instanceof SteamUser && data.serialize(),
        decode: (data: ReturnType<SteamUser["serialize"]>) => {
            const { player } = data;
            return new SteamUser(player);
        },
    },
    SteamApp: {
        encode: (data) => data instanceof SteamApp && data.serialize(),
        decode: (data: ReturnType<SteamApp["serialize"]>) => {
            const { app, lang } = data;
            return new SteamApp(app, lang);
        },
    },
    // SteamUserAchievement must come first, because it extends SteamAppAchievement
    // Otherwise, `data instanceof SteamappAchievement` will be true for SteamUserAchievement
    SteamUserAchievement: {
        encode: (data) => data instanceof SteamUserAchievement && data.serialize(),
        decode: (data: ReturnType<SteamUserAchievement["serialize"]>) => {
            const { app, global, lang, stats, steamid, userStats } = data;
            return new SteamUserAchievement(app, steamid, stats, global, userStats, lang);
        },
    },
    SteamAppAchievement: {
        encode: (data) => data instanceof SteamAppAchievement && data.serialize(),
        decode: (data: ReturnType<SteamAppAchievement["serialize"]>) => {
            const { app, global, lang, stats } = data;
            return new SteamAppAchievement(app, stats, global, lang);
        },
    },
};
