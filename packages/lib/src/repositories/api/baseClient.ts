// Keeping these for when I need to build a backend DB "janitor"
// import parse from "parse-duration";
// type DurationArg = `${number}${"s" | "m" | "h" | "d" | "w" | "mo"}`;
// type Duration = DurationArg | `${DurationArg} ${DurationArg}`;

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

    protected async fetchJSON<T, U extends boolean>(url: URL, allowEmpty: U): Promise<U extends true ? T | null : T> {
        const response = await fetch(url);
        if ([400, 403].includes(response.status) && allowEmpty) {
            // When allowEmpty is true, a 403 returns null.
            return null as U extends true ? T | null : T;
        }

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}: ${url.toString()}`);
        }

        const json = await response.json();
        return json as U extends true ? T | null : T;
    }
}
