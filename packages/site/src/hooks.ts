import { deLocalizeUrl } from "$lib/paraglide/runtime";
import {
    Errable,
    SteamApp,
    SteamAppAchievement,
    SteamFriendsList,
    SteamOwnedGame,
    SteamUser,
    SteamUserAchievement,
} from "@project/lib";
import type { Reroute, Transport } from "@sveltejs/kit";
import { SteamAppContext } from "./lib/transports/App";
import { AchievementArrayContext } from "./lib/transports/Achievements";

export const reroute: Reroute = (request) => {
    return deLocalizeUrl(request.url).pathname;
};

const appTransport = new SteamAppContext();

const userAchievementArrayTransport = new AchievementArrayContext<SteamUserAchievement>();
const appAchievementArrayTransport = new AchievementArrayContext<SteamAppAchievement>();

export const transport: Transport = {
    SteamUser: {
        encode: (data) => data instanceof SteamUser && data.serialize(),
        decode: (data: ReturnType<SteamUser["serialize"]>) => {
            const { player } = data;
            return new SteamUser(player);
        },
    },
    SteamApp: {
        encode: (data) => data instanceof SteamApp && appTransport.encode(data),
        decode: (data: ConstructorParameters<typeof SteamApp>) => appTransport.decode(data),
    },
    // SteamUserAchievement must come first, because it extends SteamAppAchievement
    // Otherwise, `data instanceof SteamappAchievement` will be true for SteamUserAchievement
    SteamUserAchievementArr: {
        encode: (data) =>
            AchievementArrayContext.isUserAchievementArray(data) && userAchievementArrayTransport.encode(data),
        decode: (data: ReturnType<(typeof userAchievementArrayTransport)["encode"]>) =>
            userAchievementArrayTransport.decodeUserAchievements(data),
    },
    SteamAppAchievementArr: {
        encode: (data) =>
            AchievementArrayContext.isAppAchievementArray(data) && appAchievementArrayTransport.encode(data),
        decode: (data: ReturnType<(typeof appAchievementArrayTransport)["encode"]>) =>
            appAchievementArrayTransport.decodeAppAchievements(data),
    },
    SteamUserAchievement: {
        encode: (data) => data instanceof SteamUserAchievement && data.serializeUser(),
        decode: (data: ReturnType<SteamUserAchievement["serializeUser"]>) => {
            const [app, stats, global, lang, steamid, userStats] = data;
            return new SteamUserAchievement(app, stats, global, lang, steamid, userStats);
        },
    },
    SteamAppAchievement: {
        encode: (data) => data instanceof SteamAppAchievement && data.serialize(),
        decode: (data: ReturnType<SteamAppAchievement["serialize"]>) => {
            const [app, stats, global, lang] = data;
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
    Errable: {
        encode: (data) => data instanceof Errable && { data: data.data, error: data.error },
        decode: (data: { data: unknown; error: Error | null }) => {
            const { data: dataValue, error: errorValue } = data;
            return new Errable(dataValue, errorValue);
        },
    },
    Error: {
        encode: (data) =>
            data instanceof Error && {
                message: data.message,
                stack: data.stack,
            },
        decode: (data: { message: string; stack?: string }) => {
            const { message, stack } = data;
            const error = new Error(message);
            if (stack) error.stack = stack;
            return error;
        },
    },
};
