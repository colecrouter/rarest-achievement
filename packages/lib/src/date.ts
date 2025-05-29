import type { LanguageCode } from "./repositories";

// cache monthMaps per‐locale
const MONTH_MAPS = new Map();

function getMonthMap(locale: LanguageCode) {
    if (MONTH_MAPS.has(locale)) return MONTH_MAPS.get(locale);

    // build "short" month-name → month index map
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    const monthMap = Array.from({ length: 12 }, (_, i) => {
        const name = fmt.format(new Date(2000, i, 1));
        return [name.toLowerCase(), i];
    }).reduce((m, [name, i]) => {
        m.set(name, i);
        return m;
    }, new Map());

    MONTH_MAPS.set(locale, monthMap);
    return monthMap;
}

function normalizeDigits(str: string) {
    // simple Arabic-Indic → Latin
    return str.replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
}

export function parseLocalizedDate(dateStr: string, locale: LanguageCode) {
    const normalizedDateStr = normalizeDigits(dateStr.replace(/\u00A0/g, " "));
    const trimmed = normalizedDateStr.trim();

    // support Japanese "YYYY年M月D日"
    if (locale === "ja") {
        const match = trimmed.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/u);
        if (match) {
            const [, yearStr, monthStr, dayStr] = match as [string, string, string, string];
            return new Date(+yearStr, +monthStr - 1, +dayStr);
        }
    }

    // 2) match "D MonName YYYY"
    const match = trimmed.match(/^(\d{1,2})\s+(.+?)\s+(\d{4})$/u);
    if (!match) throw new Error(`Unrecognized date "${dateStr}" for ${locale}`);

    const [, dayStr, monthName, yearStr] = match as [string, string, string, string];
    if (!monthName) throw new Error(`Unrecognized month name in date "${dateStr}" for ${locale}`);
    // Clean trailing comma from monthName
    const cleanedMonthName = monthName.replace(/,$/, "").toLowerCase();
    const monthMap = getMonthMap(locale);
    const monthIndex = monthMap.get(cleanedMonthName);
    if (monthIndex == null) throw new Error(`Unknown month "${monthName}"`);

    return new Date(+yearStr, monthIndex, +dayStr);
}
