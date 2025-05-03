// https://github.com/Revadike/InternalSteamWebAPI/wiki/Search-Apps

export type SearchAppsResponse = {
    appid: string;
    name: string;
    icon: string;
    logo: string;
}[];
