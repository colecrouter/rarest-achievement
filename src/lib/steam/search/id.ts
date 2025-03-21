export enum SteamIDUniverse {
    Invalid = 0,
    Public = 1,
    Beta = 2,
    Internal = 3,
    Dev = 4,
}

export enum SteamIDType {
    Individual = 1,
    Multiseat = 2,
    GameServer = 3,
    AnonGameServer = 4,
    Pending = 5,
    ContentServer = 6,
    Clan = 7,
    Chat = 8,
    ConsoleUser = 9,
    AnonUser = 10,
}

export class SteamID {
    universe: SteamIDUniverse;
    type: SteamIDType;
    instance: number;

    constructor(universe: SteamIDUniverse, type: SteamIDType, instance: number) {
        this.universe = universe;
        this.type = type;
        this.instance = instance;
    }

    static fromSteamID(steamID: string) {
        const binary = BigInt(steamID);
        const universe = Number((binary >> 56n) & 0xffn);
        const type = Number((binary >> 52n) & 0x0fn);
        const instance = Number(binary & 0xffffffffn);

        return new SteamID(universe, type, instance);
    }

    static fromSteam2ID(steamID: string) {
        const [universe, type, instance] = steamID.split(":").map(Number);

        return new SteamID(universe, type, instance);
    }

    static fromSteam3ID(steamID: string) {
        const [universe, type, instance] = steamID.slice(1, -1).split(":").map(Number);

        return new SteamID(universe, type, instance);
    }

    toSteamID(v: 1 | 2 | 3) {
        switch (v) {
            case 1:
                return (76561197960265728n + BigInt(this.instance)).toString();
            case 2:
                return `${this.universe}:${this.type}:${this.instance}`;
            case 3:
                return `[${this.universe}:${this.type}:${this.instance}]`;
        }
    }
}

const STEAM_COMMUNITY_VANITY_REGEX = /steamcommunity\.com\/id\/([a-zA-Z0-9_]{2,32})/;
const STEAM_COMMUNITY_ID_REGEX = /steamcommunity\.com\/profiles\/([0-9]{17})/;
const STEAM_ID_DEC_REGEX = /^7656119[0-9]{10}$/;
const STEAM_ID2_REGEX = /^(STEAM_[0-5]:[01]:[0-9]+)$/i;
const STEAM_ID3_REGEX = /^\[([iIUMGAPCgTLca]):([01]):([0-9]+)\]$/;
const STEAM_ACCOUNT_ID_REGEX = /^[0-9]{1,9}$/;

export const resolveSteamID = async (s: string) => {
    // https://steamcommunity.com/id/username
    if (STEAM_COMMUNITY_VANITY_REGEX.test(s)) {
        const [, username] = s.match(STEAM_COMMUNITY_VANITY_REGEX) as [string, string];
        const response = await fetch(`https://steamcommunity.com/id/${username}/?xml=1`);
        const data = await response.text();
        const steamID = data.match(/<steamID64>([0-9]{17})<\/steamID64>/)?.[1];
        if (!steamID) throw new Error("Invalid Steam ID");

        return SteamID.fromSteamID(steamID);
    }

    // https://steamcommunity.com/profiles/76561198012345678
    if (STEAM_COMMUNITY_ID_REGEX.test(s)) {
        const [, steamID] = s.match(STEAM_COMMUNITY_ID_REGEX) as [string, string];

        return SteamID.fromSteamID(steamID);
    }

    // 76561198012345678
    if (STEAM_ID_DEC_REGEX.test(s)) {
        return SteamID.fromSteamID(s);
    }

    // STEAM_0:0:12345678
    if (STEAM_ID2_REGEX.test(s)) {
        return SteamID.fromSteam2ID(s);
    }

    // [U:1:12345678]
    if (STEAM_ID3_REGEX.test(s)) {
        return SteamID.fromSteam3ID(s);
    }

    // 12345678
    if (STEAM_ACCOUNT_ID_REGEX.test(s)) {
        return SteamID.fromSteamID(`7656119${s}`);
    }

    throw new Error("Invalid Steam ID");
};
