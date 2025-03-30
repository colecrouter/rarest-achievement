export type GetFriendsListQuery = {
    steamid: string; // 64-bit Steam ID
    relationship: "friend" | "all"; // Relationship filter
};

export type GetFriendsListResponse = {
    friendslist: {
        friends: Array<{
            steamid: string; // 64-bit Steam ID
            relationship: "friend" | "all"; // Relationship
            friend_since: number; // Unix timestamp of when the friend was added
        }>;
    };
};
