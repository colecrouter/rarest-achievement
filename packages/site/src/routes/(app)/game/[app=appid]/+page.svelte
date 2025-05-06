<script lang="ts">
    import { page } from "$app/state";
    import AchievementCards from "$lib/AchievementCards";
    import FriendCards from "$lib/FriendCards";
    import IndexError from "$lib/IndexError.svelte";
    import Toolbar from "$lib/SortManager/Toolbar.svelte";
    import type { Rarity } from "$lib/rarity";
    import Calendar from "@lucide/svelte/icons/calendar";
    import GamepadIcon from "@lucide/svelte/icons/gamepad";
    import Server from "@lucide/svelte/icons/server";
    import Trophy from "@lucide/svelte/icons/trophy";
    import { SteamUserAchievement } from "@project/lib";
    import { Progress } from "@skeletonlabs/skeleton-svelte";
    import Chart from "chart.js/auto";
    import colors from "tailwindcss/colors";
    import Breadcrumbs from "../../Breadcrumbs.svelte";

    let { data } = $props();
    let { app, achievements, friends, loggedIn: user } = $derived(data);

    let recentUnlocks = $derived(
        !user
            ? null
            : achievements
                  .filter((a) => a instanceof SteamUserAchievement) // Type guard, user check should be enough
                  .filter((a) => a.unlocked)
                  .sort(
                      (a, b) =>
                          (b.unlocked?.getTime() ?? 0) -
                          (a.unlocked?.getTime() ?? 0),
                  )
                  .slice(0, 3),
    );
    let unlockedCount = $derived(
        !user
            ? 0
            : achievements
                  .filter((a) => a instanceof SteamUserAchievement)
                  .filter((achievement) => achievement.unlocked).length,
    );
    let totalCount = $derived(achievements.length);

    let isSignedIn = true;
    let donutchart: HTMLCanvasElement | null = null;

    const rarities = [
        [5, "Ultra-Rare (<5%)"],
        [10, "Rare (<10%)"],
        [50, "Uncommon (<50%)"],
        [100, "Common"],
        [-1, "Locked"],
    ] as const;
    let unlockedAchievementsGroupedByRarity = $derived([
        ...Map.groupBy(achievements?.values() ?? [], (achievement) =>
            "unlocked" in achievement && achievement.unlocked
                ? rarities.find(
                      ([percentage]) =>
                          achievement.globalPercentage <= percentage,
                  )?.[1]
                : "Locked",
        ),
    ]);

    let achievementsGroupedByRarity = $derived([
        ...Map.groupBy(
            achievements?.values() ?? [],
            (achievement) =>
                rarities.find(
                    ([percentage]) =>
                        achievement.globalPercentage <= percentage,
                )?.[1],
        ),
    ]);

    $effect(() => {
        if (!donutchart) return;

        // Ensure we have counts for each rarity in declared order.
        const unlockedAchievementCounts = rarities.map(([, label]) => {
            const group = unlockedAchievementsGroupedByRarity.find(
                ([groupLabel]) => groupLabel === label,
            );
            return group ? group[1].length : 0;
        });
        const achievementCounts = rarities.map(([, label]) => {
            const group = achievementsGroupedByRarity.find(
                ([groupLabel]) => groupLabel === label,
            );
            return group ? group[1].length : 0;
        });

        const style = getComputedStyle(document.body);
        const bgVars = [
            "--color-ultra-rare",
            "--color-rare",
            "--color-uncommon",
            "--color-common",
            "--color-locked",
        ];
        const bgPrimary = bgVars.map((key) => style.getPropertyValue(key));
        const bgSecondary = bgVars.map((key) =>
            style.getPropertyValue(`${key}-dark`),
        );
        new Chart(donutchart, {
            type: "doughnut",
            data: {
                labels: rarities.map(([, label]) => label),
                datasets: [
                    {
                        label: "Achievements",
                        data: achievementCounts,
                        backgroundColor: bgPrimary,
                        borderWidth: 4,
                        borderColor: colors.gray[800],
                        borderRadius: 4,
                    },
                    {
                        label: "Unlocked Achievements",
                        data: unlockedAchievementCounts,
                        backgroundColor: bgSecondary,
                        borderWidth: 4,
                        borderColor: colors.gray[800],
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "bottom",
                        align: "start",
                        labels: {
                            color: colors.gray[300],
                            font: {
                                size: 14,
                                family: "Segoe UI",
                            },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel(tooltipItem) {
                                return `${(100 * (Number(tooltipItem.raw) / totalCount)).toFixed(1)}% of total`;
                            },
                        },
                    },
                },
            },
        });
    });

    const barColor = (ratio: number): Rarity => {
        if (ratio >= 1) return "ultra-rare";
        if (ratio >= 0.75) return "rare";
        if (ratio >= 0.5) return "uncommon";
        return "common";
    };

    let progressColor = $derived(barColor(unlockedCount / totalCount));
</script>

<svelte:head>
    <title>{app.name} - Achievements</title>
    <meta name="description" content={app.description} />
    <link rel="icon" href={app.icon} />
    <link rel="apple-touch-icon" href={app.icon} />
    <meta property="og:title" content={app.name} />
    <meta property="og:description" content={app.description} />
    <meta property="og:image" content={app.banner} />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
</svelte:head>

<!-- Game Banner -->
<div class="relative flex h-[200px] flex-col justify-end">
    <div
        class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"
    ></div>
    <img src={app.banner} alt={app.name} class="h-full w-full object-cover" />
    <div class="absolute top-0 right-0 left-0 container pt-8">
        <!-- Breadcrumb Navigation -->
        <Breadcrumbs path={data.breadcrumbs} />
    </div>
</div>

<!-- Game Header -->
<div
    class="pointer-events-none relative container mx-auto -mb-[160px] -translate-y-[160px] px-4 pt-8 pb-6 md:pt-0"
>
    <div
        class="pointer-events-auto flex translate-y-0 flex-wrap items-end gap-6 md:translate-y-10"
    >
        <div>
            <div class="rounded-xl bg-gray-900/50 blur-sm"></div>
            <div class="rounded-xl border border-gray-700 bg-gray-800 p-2">
                <img
                    src={app.icon}
                    alt={app.name}
                    width="256"
                    height="120"
                    class="rounded-lg"
                />
            </div>
        </div>
        <div class="flex h-full flex-col items-start">
            <h1 class="mb-2 text-4xl font-bold drop-shadow-md">
                {app.name}
            </h1>
            <div class="items-center gap-4 text-sm text-gray-300">
                <div class="flex items-center gap-1">
                    <GamepadIcon class="h-4 w-4" />
                    <span>
                        {#each app.developers as developer, index}
                            {index > 0 ? ", " : ""}
                            {developer}
                        {/each}
                    </span>
                </div>
                <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4" />
                    <span
                        >{app.releaseDate?.toLocaleDateString() ??
                            "Unreleased"}</span
                    >
                </div>
                {#if isSignedIn}
                    <!-- <div class="flex items-center gap-1">
                            <Clock class="h-4 w-4" />
                            <span>{app.playtime} hours played</span>
                        </div> -->
                {/if}
            </div>
        </div>
        <div class="flex grow flex-col justify-end gap-2 md:flex-row">
            <a href="steam://run/{app.id}">
                <button
                    class="btn preset-filled-primary-500 group flex w-full md:w-auto"
                >
                    <GamepadIcon class="transition-all group-hover:rotate-12" />
                    Play on Steam
                </button>
            </a>
            <a href="https://steamdb.info/app/{app.id}/" target="_blank">
                <button
                    class="btn preset-outlined-surface-500 group flex w-full md:w-auto"
                >
                    <Server class="h-4 w-4" />
                    <span>View on SteamDB</span>
                </button>
            </a>
        </div>
    </div>
</div>

<main class="container mx-auto mt-4 px-4 py-8">
    <div class="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <!-- Achievement Progress -->
        <div class="card p-4 lg:col-span-2">
            <h2 class="mb-1 text-xl font-bold">Achievement Progress</h2>
            <p class="mb-4 text-gray-400">
                You've unlocked {unlockedCount} out of {totalCount} achievements.
            </p>
            <div class="mb-6">
                <Progress
                    value={unlockedCount}
                    max={totalCount}
                    meterBg="bg-{progressColor}"
                >
                    {((unlockedCount / totalCount) * 100).toFixed(1)}%
                </Progress>
            </div>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div class="w-full p-4">
                    <canvas bind:this={donutchart} class="h-full w-full"
                    ></canvas>
                </div>
                <div class="w-full p-4">
                    <h3 class="mb-3 text-lg font-medium">Recent Unlocks</h3>
                    <div class="space-y-3">
                        {#if recentUnlocks}
                            {#each recentUnlocks as achievement}
                                <AchievementCards.Card
                                    {achievement}
                                    secondary
                                />
                            {/each}
                            {#if recentUnlocks.length === 0}
                                <div
                                    class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center"
                                >
                                    <Trophy
                                        class="mx-auto mb-4 h-12 w-12 text-gray-600"
                                    />
                                    <h3 class="mb-2 text-xl font-bold">
                                        No Recent Unlocks
                                    </h3>
                                    <p class="mx-auto max-w-md text-gray-400">
                                        You haven't unlocked any achievements
                                        recently.
                                    </p>
                                </div>
                            {/if}
                        {:else}
                            <!-- Call to action -> sign in -->
                            <div
                                class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center"
                            >
                                <Trophy
                                    class="mx-auto mb-4 h-12 w-12 text-gray-600"
                                />
                                <h3 class="mb-2 text-xl font-bold">
                                    Unlock Achievements
                                </h3>
                                <p class="mx-auto max-w-md text-gray-400">
                                    Sign in to view your recent unlocks and
                                    progress.
                                </p>
                                <form action="/?/login" method="POST">
                                    <input
                                        type="hidden"
                                        name="redirect"
                                        value={page.url.pathname}
                                    />
                                    <button
                                        class="btn preset-filled-primary-500 mt-4 inline-block rounded-lg"
                                    >
                                        Sign In
                                    </button>
                                </form>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <!-- Game Overview -->
        <div class="card p-4">
            <h2 class="mb-3 text-xl font-bold">Game Information</h2>
            <div class="space-y-4 text-sm">
                <div>
                    <div class="mb-1 text-gray-400">Developer</div>
                    <div>
                        {#each app.developers as developer, index}
                            {index > 0 ? ", " : ""}
                            {developer}
                        {/each}
                    </div>
                </div>
                <div>
                    <div class="mb-1 text-gray-400">Publisher</div>
                    <div>
                        {#each app.publishers as publisher, index}
                            {index > 0 ? ", " : ""}
                            {publisher}
                        {/each}
                    </div>
                    <div>
                        <div class="mb-1 text-gray-400">Release Date</div>
                        <div>
                            {app.releaseDate?.toLocaleDateString() ??
                                "Unreleased"}
                        </div>
                    </div>
                    {#if isSignedIn}
                        <!-- <div>
                            <div class="mb-1 text-gray-400">Your Playtime</div>
                            <div>{app.playtime} hours</div>
                        </div>
                        <div>
                            <div class="mb-1 text-gray-400">Last Played</div>
                            <div>
                                {format(parseISO(app.lastPlayed), "MMMM d, yyyy")}
                            </div>
                        </div> -->
                    {/if}
                    <div>
                        <div class="mb-1 text-gray-400">Description</div>
                        <p class="text-gray-300">{app.description}</p>
                    </div>
                </div>
                <div class="mt-4">
                    <a
                        href={`https://store.steampowered.com/app/${app.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <button class="btn preset-outlined-surface-500 w-full">
                            View on Steam
                        </button>
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- Achievements List -->
    <section class="mb-8">
        <h2 class="mb-4 text-2xl font-bold">Achievement Leaderboard</h2>

        <Toolbar {achievements} />

        <AchievementCards {achievements} />
    </section>

    <!-- Friends Who Play -->
    <div class="mb-8">
        <h2 class="mb-6 text-2xl font-bold">Friends Who Play</h2>
        <!-- TODO island -->
        {#if isSignedIn}
            {#await friends then f}
                {#if f}
                    {@const { data: error } = f.friends}
                    {#if error}
                        <IndexError />
                    {/if}
                {/if}
            {/await}
        {/if}
        <FriendCards data={friends.then((r) => r?.friends?.data ?? null)} />
    </div>

    <!-- Similar Games -->
    <!-- <div>
        <h2 class="mb-6 text-2xl font-bold">Similar Games</h2>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {#each Array(6) as _, index}
                <div
                    class="border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
                >
                    <div class="relative aspect-square">
                        <img
                            src={`/placeholder.svg?height=200&width=200&text=Game ${index + 1}`}
                            alt={`Similar Game ${index + 1}`}
                            class="h-full w-full rounded-t-lg object-cover"
                        />
                    </div>
                    <div class="p-3">
                        <h3 class="mb-1 text-sm font-medium">
                            Similar Game {index + 1}
                        </h3>
                        <div class="flex items-center justify-between">
                            <div class="text-xs text-gray-400">
                                {Math.floor(Math.random() * 50) + 10} achievements
                            </div>
                            <div class="text-xs font-medium text-amber-500">
                                {Math.floor(Math.random() * 80) + 20}%
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div> -->
</main>
