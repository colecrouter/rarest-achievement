import { deLocalizeUrl } from "$lib/paraglide/runtime";
import {
    Attempt,
    SteamApp,
    SteamAppAchievement,
    SteamFriendUser,
    SteamOwnedGame,
    SteamUser,
    SteamUserAchievement,
    type AttemptStatus,
} from "@project/lib";
import type { Reroute, Transport } from "@sveltejs/kit";
import { AchievementArrayContext } from "./lib/transports/Achievements";
import { SteamAppContext } from "./lib/transports/App";

export const reroute: Reroute = (request) => {
    return deLocalizeUrl(request.url).pathname;
};

const appTransport = new SteamAppContext();

const userAchievementArrayTransport = new AchievementArrayContext<SteamUserAchievement>();
const appAchievementArrayTransport = new AchievementArrayContext<SteamAppAchievement>();

export const transport: Transport = {
    SteamFriendUser: {
        encode: (data) => data instanceof SteamFriendUser && data.serialize(),
        decode: (data) => new SteamFriendUser(data),
    },
    SteamUser: {
        encode: (data) => data instanceof SteamUser && data.serialize(),
        decode: (data) => new SteamUser(data),
    },
    SteamApp: {
        encode: (data) => data instanceof SteamApp && appTransport.encode(data),
        decode: (data: ReturnType<(typeof appTransport)["encode"]>) => appTransport.decode(data),
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
        encode: (data) => data instanceof SteamUserAchievement && data.serialize(),
        decode: (data) => new SteamUserAchievement(data),
    },
    SteamAppAchievement: {
        encode: (data) => data instanceof SteamAppAchievement && data.serialize(),
        decode: (data) => new SteamAppAchievement(data),
    },
    SteamOwnedGame: {
        encode: (data) => data instanceof SteamOwnedGame && data.serialize(),
        decode: (data) => new SteamOwnedGame(data),
    },
    URL: {
        encode: (data) => data instanceof URL && data.toString(),
        decode: (data: string) => new URL(data),
    },
    Attempt: {
        encode: (v) => v instanceof Attempt && { ...v },
        decode: (v: Attempt<unknown, AttemptStatus>) => {
            const { data, error, status } = v;
            return new Attempt(status, data, error);
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
