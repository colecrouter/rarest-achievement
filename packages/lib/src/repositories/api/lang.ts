const Languages = [
    // { name: "Arabic", storeCode: "ar", apiCode: "arabic" },
    // { name: "Bulgarian", storeCode: "bg", apiCode: "bulgarian" },
    { name: "Chinese (Simplified)", storeCode: "zh-CN", apiCode: "schinese" },
    { name: "Chinese (Traditional)", storeCode: "zh-TW", apiCode: "tchinese" },
    // { name: "Czech", storeCode: "cs", apiCode: "czech" },
    // { name: "Danish", storeCode: "da", apiCode: "danish" },
    // { name: "Dutch", storeCode: "nl", apiCode: "dutch" },
    { name: "English", storeCode: "en", apiCode: "english" },
    // { name: "Finnish", storeCode: "fi", apiCode: "finnish" },
    { name: "French", storeCode: "fr", apiCode: "french" },
    { name: "German", storeCode: "de", apiCode: "german" },
    // { name: "Greek", storeCode: "el", apiCode: "greek" },
    // { name: "Hungarian", storeCode: "hu", apiCode: "hungarian" },
    { name: "Indonesian", storeCode: "id", apiCode: "indonesian" },
    // { name: "Italian", storeCode: "it", apiCode: "italian" },
    { name: "Japanese", storeCode: "ja", apiCode: "japanese" },
    { name: "Korean", storeCode: "ko", apiCode: "koreana" },
    // { name: "Norwegian", storeCode: "no", apiCode: "norwegian" },
    { name: "Polish", storeCode: "pl", apiCode: "polish" },
    { name: "Portuguese (Brazil)", storeCode: "pt-BR", apiCode: "brazilian" },
    // { name: "Portuguese (Portugal)", storeCode: "pt", apiCode: "portuguese" },
    // { name: "Romanian", storeCode: "ro", apiCode: "romanian" },
    { name: "Russian", storeCode: "ru", apiCode: "russian" },
    // { name: "Spanish (Latin America)", storeCode: "es-419", apiCode: "latam" },
    { name: "Spanish (Spain)", storeCode: "es", apiCode: "spanish" },
    // { name: "Swedish", storeCode: "sv", apiCode: "swedish" },
    { name: "Thai", storeCode: "th", apiCode: "thai" },
    { name: "Turkish", storeCode: "tr", apiCode: "turkish" },
    { name: "Ukrainian", storeCode: "uk", apiCode: "ukrainian" },
    // { name: "Vietnamese", storeCode: "vn", apiCode: "vietnamese" },
] as const;

// Inferred LanguageEntry now preserves each literal type.
export type LanguageEntry = (typeof Languages)[number];

export type APILanguageCode = (typeof Languages)[number]["apiCode"];
export type LanguageCode = (typeof Languages)[number]["storeCode"];

export const getLanguageByAPICode = (code: APILanguageCode): LanguageEntry | undefined => {
    return Languages.find((lang) => lang.apiCode === code);
};

export const getLanguageByCode = (code: LanguageCode): LanguageEntry | undefined => {
    return Languages.find((lang) => lang.storeCode === code);
};

export const getLanguageByName = (name: string): LanguageEntry | undefined => {
    return Languages.find((lang) => lang.name.toLowerCase() === name.toLowerCase());
};
