import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/state";
import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";
import { getContext, setContext } from "svelte";

export type SortDirection = "asc" | "desc";
export type SortMethod = "percentage" | "count" | "unlocked";

class SortManager {
    #search = $derived.by<string>(() => page.url.searchParams.get("q") ?? "");
    #filter = $derived.by<"all" | "locked" | "unlocked">(() => {
        const v = page.url.searchParams.get("filter");
        return v === "locked" || v === "unlocked" ? v : "all";
    });
    #method = $derived.by<SortMethod>(() => {
        const v = page.url.searchParams.get("sort");
        return v === "count" || v === "unlocked" ? v : "percentage";
    });
    #direction = $derived.by<SortDirection>(() => {
        return page.url.searchParams.get("dir") === "desc" ? "desc" : "asc";
    });
    #start = $derived.by(() => {
        const v = page.url.searchParams.get("start");
        return v ? Number.parseInt(v) : 0;
    });
    #end = $derived.by(() => {
        const v = page.url.searchParams.get("end");
        return v ? Number.parseInt(v) : 30;
    });

    get search() {
        return this.#search;
    }
    set search(val: string) {
        if (this.#search === val) return;
        if (!val) {
            page.url.searchParams.delete("q");
        } else {
            page.url.searchParams.set("q", val);
        }
        goto(page.url, { replaceState: true, noScroll: true, keepFocus: true });
    }

    get filter() {
        return this.#filter;
    }
    set filter(val: "all" | "locked" | "unlocked") {
        if (this.#filter === val) return;
        if (val === "all") {
            page.url.searchParams.delete("filter");
        } else {
            page.url.searchParams.set("filter", val);
        }
        goto(page.url, { replaceState: true, noScroll: true, keepFocus: true });
    }

    get method() {
        return this.#method;
    }
    set method(val: SortMethod) {
        if (this.#method === val) return;
        if (val === "percentage") {
            page.url.searchParams.delete("sort");
        } else {
            page.url.searchParams.set("sort", val);
        }
        goto(page.url, { replaceState: true, noScroll: true, keepFocus: true });
    }

    get direction() {
        return this.#direction;
    }
    set direction(val: SortDirection) {
        if (this.#direction === val) return;
        if (val === "desc") {
            page.url.searchParams.set("dir", "desc");
        } else {
            page.url.searchParams.delete("dir");
        }
        goto(page.url, { replaceState: true, noScroll: true, keepFocus: true });
    }

    sort<T extends SteamUserAchievement | SteamAppAchievement>(achievements: T[]) {
        const search = this.#search;
        const filter = this.#filter;
        const method = this.#method;
        const direction = this.#direction;

        const filtered = achievements
            .filter((a) => {
                if (filter === "locked") {
                    return "unlocked" in a && !a.unlocked;
                }
                if (filter === "unlocked") {
                    return "unlocked" in a && a.unlocked;
                }
                return true;
            })
            .filter((a) => {
                if (!search) return true;
                return [a.name, a.description ?? "", a.app.name].some((s) =>
                    s.toLowerCase().includes(search.toLowerCase()),
                );
            })
            .sort((a, b) => {
                if (method === "percentage") {
                    return (a.globalPercentage ?? 0) - (b.globalPercentage ?? 0);
                }
                if (method === "count") {
                    if (a.globalCount === null && b.globalCount === null) return 0;
                    if (a.globalCount === null) return 1;
                    if (b.globalCount === null) return -1;
                    return a.globalCount - b.globalCount;
                }
                if (method === "unlocked") {
                    if (!("unlocked" in a && "unlocked" in b)) return 0;
                    if (a.unlocked === null && b.unlocked === null) return 0;
                    if (a.unlocked === null) return 1;
                    if (b.unlocked === null) return -1;
                    return b.unlocked.getTime() - a.unlocked.getTime();
                }
                return 0;
            });

        if (direction === "desc") {
            return filtered.slice().reverse().slice(this.#start, this.#end);
        }

        return filtered.slice(this.#start, this.#end);
    }
}

const SYMBOL = Symbol("SortManager");

export const setSortManager = () => {
    return setContext(SYMBOL, new SortManager());
};

export const getSortManager = () => {
    return getContext<SortManager>(SYMBOL);
};
