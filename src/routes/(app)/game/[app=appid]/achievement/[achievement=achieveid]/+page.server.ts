import { fetchSteamGameAchievements } from "$lib/server/classes";

export const load = async ({ parent }) => {
    const data = await parent();
    const { app } = data;

    const gameAchievements = (await fetchSteamGameAchievements([app])).get(app.id);

    return {
        gameAchievements,
    };
};

type a = {
    id: "against-all-odds";
    name: "Against All Odds";
    description: "Complete the final mission on Insane difficulty without any squad member dying";
    rarity: 0.8;
    icon: "/placeholder.svg?height=48&width=48";
    unlocked: "2023-05-15T14:32:00Z";
    isCurrent: true;
};
