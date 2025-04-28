import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";
import SearchFilter from "./SearchFilter";
import SortDirection from "./SortDirection";
import SortMethods from "./SortMethods";
import UnlockedFilter from "./UnlockedFilter";

export type Direction = "asc" | "desc";
export type Method = "percentage" | "count" | "unlocked";
export type Filter = "all" | "locked" | "unlocked";

export class SortManager {
    search = $state<string>("");
    filter = $state<Filter>("all");
    method = $state<Method>("percentage");
    direction = $state<Direction>("asc");

    sort<T extends SteamUserAchievement | SteamAppAchievement>(achievements: T[]) {
        // read directly off this.search/this.filter/…
        const bySearch = SearchFilter.search(achievements, this.search);
        const byUnlock = UnlockedFilter[this.filter](bySearch);
        const sorted = [...byUnlock].sort((a, b) => {
            const aVal = SortMethods[this.method](a);
            const bVal = SortMethods[this.method](b);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            return aVal - bVal;
        });
        return SortDirection[this.direction](sorted);
    }
}
