import type { IDetectLanguageRequest } from "./types/IDetectLanguageRequest";
import type { IDetectLanguageResponse } from "./types/IDetectLanguageResponse";
import type { ISupportedLanguagesResponse } from "./types/ISupportedLanguagesResponse";
import type { ITranslateRequest } from "./types/ITranslateRequest";
import type { ITranslateResponse } from "./types/ITranslateResponse";

export class TranslateClient {
    #apiKey: string;

    constructor(apiKey: string) {
        this.#apiKey = apiKey;
    }

    async translateText(req: ITranslateRequest): Promise<ITranslateResponse> {
        const url = new URL("https://translation.googleapis.com/language/translate/v2");
        url.searchParams.set("key", this.#apiKey);
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`translateText failed ${res.statusText}`);
        return res.json();
    }

    async detectLanguage(req: IDetectLanguageRequest): Promise<IDetectLanguageResponse> {
        const url = new URL("https://translation.googleapis.com/language/translate/v2/detect");
        url.searchParams.set("key", this.#apiKey);
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`detectLanguage failed ${res.statusText}`);
        return res.json();
    }

    async getSupportedLanguages(): Promise<ISupportedLanguagesResponse> {
        const url = new URL("https://translation.googleapis.com/language/translate/v2/languages");
        url.searchParams.set("key", this.#apiKey);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`getSupportedLanguages failed ${res.statusText}`);
        return res.json();
    }
}
