import { type Locale, isValid, parse } from "date-fns";
import { de, enUS, es, fr, id, ja, ko, pl, ptBR, ru, th, tr, uk, zhCN, zhTW } from "date-fns/locale";
import type { LanguageCode } from "./repositories";

// Optionally keep normalizeDigits if needed
function normalizeDigits(str: string) {
    // simple Arabic-Indic → Latin
    return str.replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
}

// mapping LanguageCode to date-fns locales
const localeMap: Record<string, Locale> = {
    de,
    en: enUS,
    es,
    fr,
    id,
    ja,
    ko,
    pl,
    "pt-BR": ptBR,
    ru,
    th,
    tr,
    uk,
    "zh-CN": zhCN,
    "zh-TW": zhTW,
};

// formats per locale; add or adjust formats as needed
const formatMap: Record<string, string[]> = {
    en: ["d MMM yyyy", "d MMM, yyyy"],
    ja: ["yyyy年M月d日"],
    de: ["d. MMM yyyy"],
    ru: ["d MMM yyyy", "d MMM yyyy 'г.'"],
    uk: ["d MMM yyyy"],
    es: ["d MMM yyyy"],
    fr: ["d MMM yyyy"],
    id: ["d MMM yyyy"],
    ko: ["d MMM yyyy", "yyyy년 M월 d일"],
    pl: ["d MMMM yyyy", "d MMM yyyy"],
    "pt-BR": ["d MMM yyyy", "d/MMM/yyyy", "d/MMM'.'yyyy"],
    th: ["d MMM yyyy"],
    tr: ["d MMM yyyy"],
    "zh-CN": ["yyyy年M月d日", "yyyy 年 M 月 d 日"], // updated for zh-CN
    "zh-TW": ["yyyy年M月d日", "yyyy 年 M 月 d 日"], // updated for zh-TW
};

export function parseLocalizedDate(dateStr: string, locale: LanguageCode) {
    let normalizedDateStr = normalizeDigits(dateStr.replace(/\u00A0/g, " "));
    let trimmed = normalizedDateStr.trim();

    // Pre‑normalize "pt-BR" date strings to remove the dot after month abbreviations.
    if (locale === "pt-BR") {
        trimmed = trimmed.replace(/\/([a-z]{3})\./i, "/$1");
    }

    const formats = formatMap[locale] || ["d MMM yyyy"];
    const dfnsLocale = localeMap[locale] || enUS;

    for (const fmt of formats) {
        const parsed = parse(trimmed, fmt, new Date(), { locale: dfnsLocale });
        if (isValid(parsed)) return parsed;
    }

    throw new Error(`Unrecognized date "${dateStr}" for ${locale}`);
}
