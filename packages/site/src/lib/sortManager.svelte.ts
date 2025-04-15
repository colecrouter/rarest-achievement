import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/state";
import { getContext, setContext } from "svelte";

export type SortMethod = "globalCount" | "globalPercentage";
export type SortDirection = "asc" | "desc";

class SortManager {
    #method = $derived.by<SortMethod>(() => {
        switch (page.url.searchParams.get("sort")) {
            case "count":
                return "globalCount";
            default:
                return "globalPercentage";
        }
    });
    // #direction = $derived.by<SortDirection>(() => {
    //     switch (page.url.searchParams.get("dir")) {
    //         case "desc":
    //             return "desc";
    //         default:
    //             return "asc";
    //     }
    // });

    get method() {
        return this.#method;
    }

    set method(method: SortMethod) {
        if (this.#method === method) return;
        if (method === "globalCount") {
            page.url.searchParams.set("sort", "count");
        } else {
            page.url.searchParams.delete("sort");
        }

        // TODO better way to do this?
        goto(page.url, { replaceState: true });
    }

    // get direction() {
    //     return this.#direction;
    // }

    // set direction(direction: SortDirection) {
    //     if (this.#direction === direction) return;
    //     if (direction === "desc") {
    //         page.url.searchParams.set("dir", "desc");
    //     } else {
    //         page.url.searchParams.delete("dir");
    //     }
    //     goto(page.url.pathname, { replaceState: true });
    // }
}

const SYMBOL = Symbol("SortManager");

export const setSortManager = () => {
    return setContext(SYMBOL, new SortManager());
};

export const getSortManager = () => {
    return getContext<SortManager>(SYMBOL);
};
