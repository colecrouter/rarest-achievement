<script lang="ts">
    import AchievementCards from "$lib/AchievementCards";
    import { getSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import type { SteamUser, SteamUserAchievement } from "@project/lib";
    import { Accordion, Tabs } from "@skeletonlabs/skeleton-svelte";
    import PublicProfile from "../../(static)/about/PublicProfile.svelte";
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

{#if user.private || !achievements.length}
    <!-- Friend's achievements are private -->
    <section class="mb-12">
        <h2 class="mb-6 text-center text-2xl font-bold">
            {user.displayName}'s Achievements
        </h2>

        <div class="flex min-h-[400px] flex-col items-center justify-center">
            <p class="text-surface-300 mb-8">
                Profile is private or not found.
            </p>

            <div class="w-full max-w-[800px]">
                <Accordion multiple>
                    <Accordion.Item value="0">
                        {#snippet control()}
                            Why is my profile private?
                        {/snippet}
                        {#snippet panel()}
                            <p class="p-4">
                                Your Steam profile has privacy settings that
                                prevent others from seeing it. In order for
                                Steam Vault to see your achievements, you need
                                to make your profile public. You can do this by
                                following the instructions below.
                            </p>
                        {/snippet}
                    </Accordion.Item>
                    <Accordion.Item value="1">
                        {#snippet control()}
                            How do I make my profile public?
                        {/snippet}
                        {#snippet panel()}
                            <PublicProfile />
                        {/snippet}
                    </Accordion.Item>
                </Accordion>
            </div>
        </div>
    </section>
{:else}
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
                    <p class="text-surface-300">
                        No achievements unlocked yet.
                    </p>
                </div>
            {/if}

            <!-- Base -->
            <div
                class="bg-surface-700 absolute bottom-0 h-8 w-full rounded"
            ></div>
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
                        class="border-surface-700 bg-surface-800 overflow-hidden rounded border"
                    >
                        <table class="w-full">
                            <thead>
                                <tr
                                    class="border-surface-700 bg-surface-900/50 border-b"
                                >
                                    <th
                                        class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                                    >
                                        Achievement
                                    </th>
                                    <th
                                        class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                                    >
                                        Game
                                    </th>
                                    <th
                                        class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                                    >
                                        Rarity
                                    </th>
                                    <th
                                        class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                                    >
                                        Unlocked
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-surface-700 divide-y">
                                {#each filteredAchievements as achievement}
                                    {#if achievement.unlocked !== null}
                                        <tr
                                            class="hover:bg-surface-700/30 transition-colors"
                                        >
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
                                                <div
                                                    class="flex items-center gap-3"
                                                >
                                                    <img
                                                        src={achievement.icon}
                                                        alt={achievement.name}
                                                        width="32"
                                                        height="32"
                                                        class="border-surface-700 bg-surface-900 rounded border"
                                                    />
                                                    <div>
                                                        <div
                                                            class="text-surface-100 text-sm font-medium"
                                                        >
                                                            {achievement.name}
                                                        </div>
                                                        <div
                                                            class="text-surface-300 line-clamp-1 text-xs"
                                                        >
                                                            {achievement.description}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td
                                                class="text-surface-300 px-4 py-3 text-sm whitespace-nowrap"
                                                >{achievement.app.name}</td
                                            >
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
                                                <span
                                                    class="bg-primary-500/10 text-primary-500 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                >
                                                    {achievement.globalPercentage}%
                                                </span>
                                            </td>
                                            <td
                                                class="text-surface-300 px-4 py-3 text-sm whitespace-nowrap"
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
{/if}
