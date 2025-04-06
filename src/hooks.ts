import { i18n } from "$lib/i18n";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamFriendsList } from "$lib/steam/data/SteamFriendsList";
import { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame";
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
            const { app } = data;
            return new SteamApp(app);
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
    SteamOwnedGame: {
        encode: (data) => data instanceof SteamOwnedGame && data.serialize(),
        decode: (data: ReturnType<SteamOwnedGame["serialize"]>) => {
            const { owned } = data;
            return new SteamOwnedGame(owned);
        },
    },
    SteamFriendsList: {
        encode: (data) => data instanceof SteamFriendsList && data.serialize(),
        decode: (data: ReturnType<SteamFriendsList["serialize"]>) => {
            const { steamid, friends } = data;
            return new SteamFriendsList(steamid, friends);
        },
    },
    URL: {
        encode: (data) => data instanceof URL && data.toString(),
        decode: (data: string) => new URL(data),
    },
};
