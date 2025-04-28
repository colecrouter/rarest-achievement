import { SteamUserAchievement, type SteamAppAchievement } from "@project/lib";

export type SortMethod = (a: SteamAppAchievement | SteamUserAchievement) => number | null;

const percentage: SortMethod = (a) => a.globalPercentage;

const count: SortMethod = (a) => a.globalCount;

const unlocked: SortMethod = (a) => {
    if (a instanceof SteamUserAchievement) {
        return a.unlocked?.getTime() ?? null;
    }
    return null;
};

export default {
    percentage,
    count,
    unlocked,
};
