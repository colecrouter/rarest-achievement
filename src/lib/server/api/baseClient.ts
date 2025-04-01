import { getRequestEvent } from "$app/server";
import parse from "parse-duration";

type DurationArg = `${number}${"s" | "m" | "h" | "d" | "w" | "mo"}`;
type Duration = DurationArg | `${DurationArg} ${DurationArg}`;

export abstract class BaseSteamAPIClient {
    protected applyOptions<T extends Record<string, string | number | string[] | number[] | boolean | undefined>>(
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

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        return await response.json();
    }
}
