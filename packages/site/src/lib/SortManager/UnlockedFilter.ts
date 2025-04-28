import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";

export type UnlockedFilter = <T extends SteamAppAchievement | SteamUserAchievement>(list: T[]) => T[];

const unlocked: UnlockedFilter = (list) => list.filter((a) => "unlocked" in a && a.unlocked);

const locked: UnlockedFilter = (list) => list.filter((a) => "unlocked" in a && !a.unlocked);

const all: UnlockedFilter = (list) => list;

export default {
    unlocked,
    locked,
    all,
};
