<script lang="ts">
    import { Tabs, Tooltip } from "@skeletonlabs/skeleton-svelte";
    import {
        Award,
        Crown,
        Medal,
        Search,
        SortAsc,
        SortDesc,
    } from "lucide-svelte";
    import AchievementCard from "./AchievementCard.svelte";

    let { data } = $props();
    let achievements = $derived(data.achievements);

    // Mock data for achievements
    let sortOrder = $state<"asc" | "desc">("asc");
    let searchQuery = $state("");
    let activeTab = $state("grid");

    let topThree = $derived(achievements.slice(0, 3));
    let filteredAchievements = $derived(
        achievements
            .filter(
                (achievement) =>
                    achievement.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    achievement.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
            )
            .sort((a, b) =>
                sortOrder === "asc" ? a.rarity - b.rarity : b.rarity - a.rarity,
            ),
    );
</script>

<!-- Header -->

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    <!-- Hero Section with Podium -->
    <section class="mb-12">
        <h2 class="mb-6 text-center text-2xl font-bold">
            Your Rarest Achievements
        </h2>
        <div
            class="relative mb-8 flex h-[400px] items-end justify-center gap-4"
        >
            <!-- Second Place -->
            <div class="relative z-10 flex w-[200px] flex-col items-center">
                <div class="mb-2 flex flex-col items-center">
                    <Medal class="h-8 w-8 text-gray-300" />
                    <span class="text-sm font-medium text-gray-300"
                        >2nd Place</span
                    >
                    <span class="text-xs text-amber-500"
                        >{topThree[1].rarity}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-gray-700 bg-gray-800 p-4"
                >
                    <div class="relative mb-2">
                        <div class="absolute -top-12 left-1/2 -translate-x-1/2">
                            <img
                                src={topThree[1].icon || "/placeholder.svg"}
                                alt={topThree[1].name}
                                width="64"
                                height="64"
                                class="rounded-md border-2 border-gray-700 bg-gray-900"
                            />
                        </div>
                    </div>
                    <h3 class="mt-8 text-center font-bold">
                        {topThree[1].name}
                    </h3>
                    <p class="mt-1 text-center text-xs text-gray-400">
                        {topThree[1].game.name}
                    </p>
                </div>
                <div
                    class="h-[120px] w-full border-x border-gray-700 bg-gradient-to-t from-gray-700 to-gray-800"
                ></div>
            </div>

            <!-- First Place -->
            <div class="relative z-20 flex w-[220px] flex-col items-center">
                <div class="mb-2 flex flex-col items-center">
                    <Crown class="h-10 w-10 text-amber-500" />
                    <span class="text-sm font-bold text-amber-500"
                        >1st Place</span
                    >
                    <span class="text-xs text-amber-500"
                        >{topThree[0].rarity}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-amber-600/30 bg-gray-800 p-4 shadow-lg shadow-amber-900/20"
                >
                    <div class="relative mb-2">
                        <div class="absolute -top-14 left-1/2 -translate-x-1/2">
                            <div class="relative">
                                <div
                                    class="absolute inset-0 animate-pulse rounded-full bg-amber-500/20"
                                ></div>
                                <img
                                    src={topThree[0].icon || "/placeholder.svg"}
                                    alt={topThree[0].name}
                                    width="80"
                                    height="80"
                                    class="relative z-10 rounded-md border-2 border-amber-500 bg-gray-900"
                                />
                            </div>
                        </div>
                    </div>
                    <h3 class="mt-10 text-center font-bold text-amber-100">
                        {topThree[0].name}
                    </h3>
                    <p class="mt-1 text-center text-xs text-amber-300/70">
                        {topThree[0].game.name}
                    </p>
                </div>
                <div
                    class="h-[160px] w-full border-x border-amber-700/30 bg-gradient-to-t from-amber-900/30 to-gray-800"
                ></div>
            </div>

            <!-- Third Place -->
            <div class="relative z-10 flex w-[180px] flex-col items-center">
                <div class="mb-2 flex flex-col items-center">
                    <Award class="h-7 w-7 text-amber-700" />
                    <span class="text-sm font-medium text-amber-700"
                        >3rd Place</span
                    >
                    <span class="text-xs text-amber-500"
                        >{topThree[2].rarity}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-gray-700 bg-gray-800 p-4"
                >
                    <div class="relative mb-2">
                        <div class="absolute -top-10 left-1/2 -translate-x-1/2">
                            <img
                                src={topThree[2].icon || "/placeholder.svg"}
                                alt={topThree[2].name}
                                width="56"
                                height="56"
                                class="rounded-md border-2 border-gray-700 bg-gray-900"
                            />
                        </div>
                    </div>
                    <h3 class="mt-8 text-center font-bold">
                        {topThree[2].name}
                    </h3>
                    <p class="mt-1 text-center text-xs text-gray-400">
                        {topThree[2].game.name}
                    </p>
                </div>
                <div
                    class="h-[100px] w-full border-x border-gray-700 bg-gradient-to-t from-gray-700 to-gray-800"
                ></div>
            </div>

            <!-- Base -->
            <div
                class="absolute bottom-0 h-8 w-full rounded-md bg-gray-700"
            ></div>
        </div>
    </section>

    <!-- Achievement Leaderboard -->
    <section>
        <div
            class="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row"
        >
            <h2 class="text-2xl font-bold">Achievement Leaderboard</h2>
            <div class="flex w-full items-center gap-3 md:w-auto">
                <div class="relative flex-1 md:w-64">
                    <Search
                        class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500"
                    />
                    <input
                        type="search"
                        placeholder="Search achievements..."
                        class="input w-full border-gray-700 bg-gray-800 pl-8 text-gray-100"
                        bind:value={searchQuery}
                    />
                </div>
                <!-- <Tooltip>
                    {#snippet trigger()}
                        <div>
                            <button
                                class="btn btn-icon preset-outlined-primary"
                                onclick={() =>
                                    (sortOrder =
                                        sortOrder === "asc" ? "desc" : "asc")}
                            >
                                {#if sortOrder === "asc"}
                                    <SortAsc class="h-4 w-4" />
                                {:else}
                                    <SortDesc class="h-4 w-4" />
                                {/if}
                            </button>
                        </div>
                    {/snippet}
                    {#snippet content()}
                        <div>
                            Sort by {sortOrder === "asc"
                                ? "ascending"
                                : "descending"} rarity
                        </div>
                    {/snippet}
                </Tooltip> -->
            </div>
        </div>

        <!-- Tabs -->
        <Tabs value={activeTab} onValueChange={(e) => (activeTab = e.value)}>
            {#snippet list()}
                <Tabs.Control value="grid">Grid View</Tabs.Control>
                <Tabs.Control value="list">List View</Tabs.Control>
            {/snippet}

            {#snippet content()}
                <Tabs.Panel value="grid">
                    <div
                        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    >
                        {#each filteredAchievements as achievement}
                            <AchievementCard
                                icon={achievement.icon}
                                name={achievement.name}
                                game={achievement.game.name}
                                description={achievement.description}
                                unlocked={achievement.unlocked}
                                rarity={achievement.rarity}
                            />
                        {/each}
                    </div>
                </Tabs.Panel>

                <Tabs.Panel value="list">
                    <div
                        class="overflow-hidden rounded-md border border-gray-700 bg-gray-800"
                    >
                        <table class="w-full">
                            <thead>
                                <tr
                                    class="border-b border-gray-700 bg-gray-900/50"
                                >
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
                                    <tr
                                        class="transition-colors hover:bg-gray-700/30"
                                    >
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <img
                                                    src={achievement.icon ||
                                                        "/placeholder.svg"}
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
                                            >{achievement.game}</td
                                        >
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span
                                                class="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"
                                            >
                                                {achievement.rarity}%
                                            </span>
                                        </td>
                                        <td
                                            class="px-4 py-3 text-sm whitespace-nowrap text-gray-400"
                                        >
                                            {new Date(
                                                achievement.unlocked,
                                            ).toLocaleDateString()}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </Tabs.Panel>
            {/snippet}
        </Tabs>
    </section>
</main>
