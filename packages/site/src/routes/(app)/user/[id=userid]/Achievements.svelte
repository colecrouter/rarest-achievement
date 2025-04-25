<script lang="ts">
    import AchievementCards from "$lib/AchievementCards";
    import { getSortManager } from "$lib/SortManager/index.svelte";
    import type { SteamUser, SteamUserAchievement } from "@project/lib";
    import { Tabs } from "@skeletonlabs/skeleton-svelte";
    import Toolbar from "../../../../lib/SortManager/Toolbar.svelte";
    import Podium from "./Podium.svelte";

    interface Props {
        achievements: SteamUserAchievement[];
        user: SteamUser;
    }
    let { achievements, user }: Props = $props();

    const sortManager = getSortManager();

    let activeTab = $state("grid");

    let topThree = $derived(sortManager.sort(achievements).slice(0, 3));
    let filteredAchievements = $derived(sortManager.sort(achievements));
</script>

<!-- Hero Section with Podium -->
<section class="mb-12">
    <h2 class="mb-6 text-center text-2xl font-bold">
        {user.displayName}'s Rarest Achievements
    </h2>

    <div
        class="relative mt-12 mb-8 flex h-[400px] items-end justify-center gap-4"
    >
        {#if topThree.length === 3}
            {#key filteredAchievements}
                <Podium place={2} achievement={topThree[1]!} />

                <Podium place={1} achievement={topThree[0]!} />

                <Podium place={3} achievement={topThree[2]!} />
            {/key}
        {:else}
            <!-- Base thing -->
            <div class="flex h-full w-full items-center justify-center">
                <p class="text-gray-400">No achievements unlocked yet.</p>
            </div>
        {/if}

        <!-- Base -->
        <div class="absolute bottom-0 h-8 w-full rounded-md bg-gray-700"></div>
    </div>
</section>

<!-- Achievement Leaderboard -->
<section>
    <h2 class="mb-4 text-2xl font-bold">Achievement Leaderboard</h2>

    <Toolbar {achievements} />

    <!-- Tabs -->
    <Tabs value={activeTab} onValueChange={(e) => (activeTab = e.value)}>
        {#snippet list()}
            <Tabs.Control value="grid">Grid View</Tabs.Control>
            <Tabs.Control value="list">List View</Tabs.Control>
        {/snippet}

        {#snippet content()}
            <Tabs.Panel value="grid">
                <AchievementCards {achievements} />
            </Tabs.Panel>

            <Tabs.Panel value="list">
                <div
                    class="overflow-hidden rounded-md border border-gray-700 bg-gray-800"
                >
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-gray-700 bg-gray-900/50">
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400 uppercase"
                                >
                                    Achievement
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400 uppercase"
                                >
                                    Game
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400 uppercase"
                                >
                                    Rarity
                                </th>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400 uppercase"
                                >
                                    Unlocked
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-700">
                            {#each filteredAchievements as achievement}
                                {#if achievement.unlocked !== null}
                                    <tr
                                        class="transition-colors hover:bg-gray-700/30"
                                    >
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <img
                                                    src={achievement.icon}
                                                    alt={achievement.name}
                                                    width="32"
                                                    height="32"
                                                    class="rounded-md border border-gray-700 bg-gray-900"
                                                />
                                                <div>
                                                    <div
                                                        class="text-sm font-medium text-gray-100"
                                                    >
                                                        {achievement.name}
                                                    </div>
                                                    <div
                                                        class="line-clamp-1 text-xs text-gray-400"
                                                    >
                                                        {achievement.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td
                                            class="px-4 py-3 text-sm whitespace-nowrap text-gray-400"
                                            >{achievement.app.name}</td
                                        >
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span
                                                class="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"
                                            >
                                                {achievement.globalPercentage}%
                                            </span>
                                        </td>
                                        <td
                                            class="px-4 py-3 text-sm whitespace-nowrap text-gray-400"
                                        >
                                            {achievement.unlocked.toLocaleDateString()}
                                        </td>
                                    </tr>
                                {/if}
                            {/each}
                        </tbody>
                    </table>
                </div>
            </Tabs.Panel>
        {/snippet}
    </Tabs>
</section>
