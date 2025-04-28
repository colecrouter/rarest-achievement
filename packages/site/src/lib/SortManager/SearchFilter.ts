import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";

export type SearchFilter = <T extends SteamAppAchievement | SteamUserAchievement>(list: T[], term: string) => T[];

const search: SearchFilter = (list, text) => {
    const terms = text.toLowerCase().split(" ");
    return list.filter((item) => {
        const name = item.name.toLowerCase();
        const desc = item.description?.toLowerCase() ?? "";
        const appName = item.app.name.toLowerCase();
        return terms.every((term) => name.includes(term) || desc.includes(term) || appName.includes(term));
    });
};

export default {
    search,
};
