<script lang="ts">
    import { Tabs } from "@skeletonlabs/skeleton-svelte";
    import { Award, Crown, Medal, Search } from "lucide-svelte";
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
                    achievement.displayName
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    achievement.displayName
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
            )
            .sort((a, b) =>
                sortOrder === "asc"
                    ? a.globalPercentage - b.globalPercentage
                    : b.globalPercentage - a.globalPercentage,
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
            class="relative mt-12 mb-8 flex h-[400px] items-end justify-center gap-4"
        >
            <!-- Second Place -->
            <div class="relative z-10 flex w-[200px] flex-col items-center">
                <div class="mb-2 flex flex-col items-center">
                    <Medal class="h-8 w-8 text-gray-300" />
                    <span class="text-sm font-medium text-gray-300"
                        >2nd Place</span
                    >
                    <span class="text-xs text-amber-500"
                        >{topThree[1].globalPercentage}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-gray-700 bg-gray-800 p-4"
                >
                    <img
                        src={topThree[1].icon || "/placeholder.svg"}
                        alt={topThree[1].displayName}
                        width="64"
                        height="64"
                        class="rounded-md border-2 border-gray-700 bg-gray-900"
                    />

                    <h3 class="mt-2 text-center font-bold">
                        {topThree[1].displayName}
                    </h3>
                    <p class="mt-1 text-center text-xs text-gray-400">
                        {topThree[1].app.name}
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
                        >{topThree[0].globalPercentage}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-amber-600/30 bg-gray-800 p-4 shadow-lg shadow-amber-900/20"
                >
                    <img
                        src={topThree[0].icon || "/placeholder.svg"}
                        alt={topThree[0].displayName}
                        width="80"
                        height="80"
                        class="z-10 rounded-md border-2 border-amber-500 bg-gray-900"
                    />

                    <h3 class="mt-2 text-center font-bold text-amber-100">
                        {topThree[0].displayName}
                    </h3>
                    <p class="mt-1 text-center text-xs text-amber-300/70">
                        {topThree[0].app.name}
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
                        >{topThree[2].globalPercentage}% of players</span
                    >
                </div>
                <div
                    class="flex w-full flex-col items-center rounded-t-lg border border-gray-700 bg-gray-800 p-4"
                >
                    <img
                        src={topThree[2].icon || "/placeholder.svg"}
                        alt={topThree[2].displayName}
                        width="56"
                        height="56"
                        class="rounded-md border-2 border-gray-700 bg-gray-900"
                    />

                    <h3 class="mt-2 text-center font-bold">
                        {topThree[2].displayName}
                    </h3>
                    <p class="mt-1 text-center text-xs text-gray-400">
                        {topThree[2].app.name}
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
                            {#if achievement.unlocked !== null}
                                <AchievementCard
                                    icon={achievement.icon}
                                    name={achievement.displayName}
                                    game={achievement.app.name}
                                    description={achievement.description}
                                    unlocked={achievement.unlocked}
                                    rarity={achievement.globalPercentage}
                                />
                            {/if}
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
                                    {#if achievement.unlocked !== null}
                                        <tr
                                            class="transition-colors hover:bg-gray-700/30"
                                        >
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
                                                <div
                                                    class="flex items-center gap-3"
                                                >
                                                    <img
                                                        src={achievement.icon ||
                                                            "/placeholder.svg"}
                                                        alt={achievement.displayName}
                                                        width="32"
                                                        height="32"
                                                        class="rounded-md border border-gray-700 bg-gray-900"
                                                    />
                                                    <div>
                                                        <div
                                                            class="text-sm font-medium text-gray-100"
                                                        >
                                                            {achievement.displayName}
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
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
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
</main>
