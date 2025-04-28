import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";

export type SortDirection = <T extends SteamAppAchievement | SteamUserAchievement>(list: T[]) => T[];

const asc: SortDirection = (list) => list;
const desc: SortDirection = (list) => list.slice().reverse();

export default {
    asc,
    desc,
};
