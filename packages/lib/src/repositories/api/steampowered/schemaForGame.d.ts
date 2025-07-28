// https://wiki.teamfortress.com/wiki/WebAPI/GetSchemaForGame

import type { APILanguageCode } from "../../../lang";

export type GetSchemaForGameQuery = {
    appid: number; // AppID
    l?: APILanguageCode; // Language (optional)
};

export type GetSchemaForGameResponse = {
    game: {
        gameName: string;
        gameVersion: number;
        availableGameStats?: {
            achievements?: Array<{
                name: string;
                defaultvalue: number;
                displayName: string;
                hidden: number;
                description?: string;
                icon: string;
                icongray: string;
            }>;
            stats?: Array<{
                name: string;
                defaultvalue: number;
                displayName: string;
            }>;
        };
    };
};
