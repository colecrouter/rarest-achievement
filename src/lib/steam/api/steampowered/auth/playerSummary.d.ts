export type GetPlayerSummariesQuery = {
    steamids: string; // Comma-separated list of 64-bit Steam IDs
};

type PublicData = {
    steamid: string; // 64-bit Steam ID
    personaname: string; // Steam username
    profileurl: string; // URL to the user's Steam Community profile
    avatar: string; // URL to the user's avatar 32x32
    avatarmedium: string; // URL to the user's avatar 64x64
    avatarfull: string; // URL to the user's avatar 184x184
    personastate: number; // Current status of the user
    communityvisibilitystate: number; // Community visibility state
    profilestate: number; // Profile state
    lastlogoff: number; // Last time the user was online
    commentpermission: number; // Comment permissions
};

type PrivateData = {
    realname: string; // Real name
    primaryclanid: string; // Primary group
    timecreated: number; // Time created
    gameid: string; // Game ID currently playing
    gameserverip: string; // IP address of the server user is playing on
    gameextrainfo: string; // If the user is in a game, this will be the name of it
    loccountrycode: string; // Country code
    locstatecode: string; // State code
    loccityid: number; // City ID
};

export type GetPlayerSummariesResponse = {
    response: {
        players: Array<PublicData | (PublicData & PrivateData)>;
    };
};
