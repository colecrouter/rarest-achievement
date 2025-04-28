import { getContext, setContext } from "svelte";
import { type Direction, type Filter, type Method, SortManager } from "./Manager.svelte";
import { goto } from "$app/navigation";

class UrlParamMapper {
    #fn: () => URL;
    // @ts-ignore
    #url = $derived(this.#fn());
    // This junk is a workaround for the fact that we can't declare a derived value from a reactive value in a constructor
    // https://github.com/sveltejs/svelte/issues/11116

    #manager = new SortManager();

    constructor(fn: () => URL) {
        this.#fn = fn;

        $effect(() => {
            const url = this.#url;
            this.#manager.search = url.searchParams.get("q") ?? "";
            this.#manager.filter = (url.searchParams.get("filter") as Filter) ?? "all";
            this.#manager.method = (url.searchParams.get("sort") as Method) ?? "percentage";
            this.#manager.direction = (url.searchParams.get("dir") as Direction) ?? "asc";
        });

        $effect(() => {
            const url = this.#url;
            url.searchParams.set("q", this.#manager.search);
            url.searchParams.set("filter", this.#manager.filter);
            url.searchParams.set("sort", this.#manager.method);
            url.searchParams.set("dir", this.#manager.direction);

            goto(url.toString(), {
                replaceState: true,
                noScroll: true,
                keepFocus: true,
                invalidateAll: false,
            });
        });
    }
}

const SYMBOL = Symbol("SortManager");

export const setSortManager = () => {
    return setContext(SYMBOL, new SortManager());
};

export const getSortManager = () => {
    return getContext<SortManager>(SYMBOL);
};
