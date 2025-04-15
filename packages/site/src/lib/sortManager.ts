import { page } from "$app/state";

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
    #direction = $derived.by<SortDirection>(() => {
        switch (page.url.searchParams.get("dir")) {
            case "desc":
                return "desc";
            default:
                return "asc";
        }
    });
}
