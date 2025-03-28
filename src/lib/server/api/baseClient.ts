import { getRequestEvent } from "$app/server";
import parse from "parse-duration";

type DurationArg = `${number}${"s" | "m" | "h" | "d" | "w" | "mo"}`;
type Duration = DurationArg | `${DurationArg} ${DurationArg}`;

export abstract class BaseSteamAPIClient {
    protected applyOptions<T extends Record<string, string | number | string[] | number[] | undefined>>(
        url: URL,
        options: T,
    ) {
        for (const [key, value] of Object.entries(options)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
                url.searchParams.set(key, value.join(","));
                continue;
            }

            url.searchParams.set(key, String(value));
        }
    }

    protected async fetchJSON<T>(url: URL, ttl: Duration): Promise<T> {
        const { platform, fetch } = getRequestEvent();
        if (!platform) throw new Error("Platform not found");

        const { STEAM_CACHE } = platform.env;

        const cacheKey = url.toString();
        const cached = await STEAM_CACHE.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const json = await response.json();
        const cacheMS = parse(ttl);
        if (!cacheMS) throw new Error(`Invalid TTL: ${ttl}`);
        if (cacheMS < 0) throw new Error(`TTL must be positive: ${ttl}`);

        await STEAM_CACHE.put(cacheKey, JSON.stringify(json), { expirationTtl: cacheMS / 1000 });

        return json;
    }
}
