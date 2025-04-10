<script lang="ts">
    import Chart from "chart.js/auto";
    import {
        ArrowLeft,
        Calendar,
        GamepadIcon,
        Search,
        Server,
        Trophy,
    } from "lucide-svelte";
    import colors from "tailwindcss/colors";
    import AchievementCard from "../../user/[id=userid]/AchievementCard.svelte";
    import { SteamUserStatus } from "$lib/steam/data/SteamUser";
    import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";
    import { Progress } from "@skeletonlabs/skeleton-svelte";

    let { data } = $props();
    let { app, achievements, friends, user } = $derived(data);

    let recentUnlocks = $derived(
        !user
            ? null
            : [...(achievements?.values() ?? [])]
                  .flat()
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
            : [...(achievements?.values() ?? [])]
                  .filter((a) => a instanceof SteamUserAchievement)
                  .filter((achievement) => achievement.unlocked).length,
    );
    let totalCount = $derived(achievements?.size ?? 0);

    let isSignedIn = true;
    let achievementFilter: "all" | "unlocked" | "locked" = "all";
    let searchQuery = "";
    let sortOrder: "name" | "rarity" | "date" = "rarity";
    let sortDirection: "asc" | "desc" = "asc";
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

        new Chart(donutchart, {
            type: "doughnut",
            data: {
                labels: rarities.map(([, label]) => label),
                datasets: [
                    {
                        label: "Achievements",
                        data: achievementCounts,
                        backgroundColor: [
                            colors.amber[500],
                            colors.gray[400],
                            colors.gray[500],
                            colors.slate[600],
                            colors.gray[700],
                        ],
                        borderWidth: 4,
                        borderColor: colors.gray[800],
                        borderRadius: 4,
                    },
                    {
                        label: "Unlocked Achievements",
                        data: unlockedAchievementCounts,
                        backgroundColor: [
                            colors.amber[500],
                            colors.gray[400],
                            colors.gray[500],
                            colors.slate[600],
                            colors.gray[700],
                        ],
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

    let filteredAchievements = $derived(
        [...(achievements?.values() ?? [])]
            .filter((achievement) => {
                // if (
                //     achievementFilter === "unlocked" &&
                //     achievement.status !== "unlocked"
                // )
                //     return false;
                // if (
                //     achievementFilter === "locked" &&
                //     achievement.status !== "locked"
                // )
                //     return false;
                if (
                    searchQuery &&
                    !achievement.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) &&
                    !achievement.description
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                )
                    return false;
                return true;
            })
            .sort((a, b) => {
                if (sortOrder === "name")
                    return sortDirection === "asc"
                        ? a.name.localeCompare(b.name)
                        : b.name.localeCompare(a.name);

                if (sortOrder === "rarity")
                    return sortDirection === "asc"
                        ? a.globalPercentage - b.globalPercentage
                        : b.globalPercentage - a.globalPercentage;
                if (sortOrder === "date") {
                    // if (a.status === "locked" && b.status === "unlocked")
                    //     return 1;
                    // if (a.status === "unlocked" && b.status === "locked")
                    //     return -1;
                    // if (a.status === "locked" && b.status === "locked")
                    //     return 0;
                    // const dateA = a.unlocked
                    //     ? new Date(a.unlocked).getTime()
                    //     : 0;
                    // const dateB = b.unlocked
                    //     ? new Date(b.unlocked).getTime()
                    //     : 0;
                    // return sortDirection === "asc"
                    //     ? dateA - dateB
                    //     : dateB - dateA;
                }
                return 0;
            }),
    );
</script>

<!-- Game Banner -->
<div class="relative h-[300px]">
    <div
        class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"
    ></div>
    <img src={app.banner} alt={app.name} class="h-full w-full object-cover" />
    <div class="absolute right-0 -bottom-2 left-0 container mx-auto px-4 py-6">
        <div class="flex items-end gap-6">
            <div class="relative translate-y-10">
                <div
                    class="absolute -inset-2 rounded-xl bg-gray-900/50 blur-sm"
                ></div>
                <div
                    class="relative rounded-xl border border-gray-700 bg-gray-800 p-2"
                >
                    <img
                        src={app.icon}
                        alt={app.name}
                        width="256"
                        class="rounded-lg"
                    />
                </div>
            </div>
            <div class="flex-1">
                <h1 class="mb-2 text-4xl font-bold drop-shadow-md">
                    {app.name}
                </h1>
                <div class="flex items-center gap-4 text-sm text-gray-300">
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
            <div class="flex gap-2">
                <a href="steam://run/{app.id}">
                    <button class="btn preset-filled-primary-500 group flex">
                        <GamepadIcon
                            class="transition-all group-hover:rotate-12"
                        />
                        Play on Steam
                    </button>
                </a>
                <a href="https://steamdb.info/app/{app.id}/" target="_blank">
                    <button class="btn preset-outlined-surface-500 group flex">
                        <Server class="h-4 w-4" />
                        <span>View on SteamDB</span>
                    </button>
                </a>
            </div>
        </div>
    </div>
</div>

<main class="container mx-auto mt-4 px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <div class="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <a
            href="/dashboard"
            class="flex items-center gap-1 hover:text-gray-100"
        >
            <ArrowLeft class="h-4 w-4" />
            <span>Back to Dashboard</span>
        </a>
        <span>/</span>
        <span class="text-gray-100">{app.name}</span>
    </div>

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
                    meterBg={unlockedCount === totalCount
                        ? "bg-amber-500"
                        : "bg-blue-500"}
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
                                <a
                                    href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
                                    class="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900/50 p-2 hover:bg-gray-700/30"
                                >
                                    <img
                                        src={achievement.icon ||
                                            "/placeholder.svg"}
                                        alt={achievement.name}
                                        width="36"
                                        height="36"
                                        class="rounded-md border border-gray-700"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <h4
                                                class="truncate text-sm font-medium"
                                            >
                                                {achievement.name}
                                            </h4>
                                            <div
                                                class="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-gray-900"
                                            >
                                                {achievement.globalPercentage}%
                                            </div>
                                        </div>
                                        <div
                                            class="mt-0.5 text-xs text-gray-400"
                                        >
                                            {achievement.unlocked?.toLocaleString(
                                                undefined,
                                                {
                                                    dateStyle: "short",
                                                    timeStyle: "short",
                                                },
                                            )}
                                        </div>
                                    </div>
                                </a>
                            {/each}
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
                                <a
                                    href="/login"
                                    class="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-400"
                                    >Sign In</a
                                >
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
    <div class="mb-8">
        <div
            class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
        >
            <h2 class="text-2xl font-bold">Achievements</h2>
            <div class="flex w-full flex-wrap items-center gap-3 md:w-auto">
                <div class="relative flex-1 md:w-64">
                    <Search
                        class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500"
                    />
                    <input
                        type="search"
                        placeholder="Search achievements..."
                        bind:value={searchQuery}
                        class="w-full border-gray-700 bg-gray-800 pl-8 text-gray-100"
                    />
                </div>
            </div>
        </div>

        <div
            class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
            {#each filteredAchievements as achievement}
                <AchievementCard {achievement} />
                <!-- <div
                        class="overflow-hidden border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600 {achievement.status ===
                        'locked'
                            ? 'opacity-70'
                            : ''}"
                    >
                        <div class="p-0">
                            <div class="flex items-start gap-3 p-4">
                                <div class="relative flex-shrink-0">
                                    <img
                                        src={achievement.icon ||
                                            "/placeholder.svg"}
                                        alt={achievement.name}
                                        width="48"
                                        height="48"
                                        class="rounded-md border {achievement.status ===
                                        'unlocked'
                                            ? 'border-gray-700 bg-gray-900'
                                            : 'border-gray-700 bg-gray-900/50 grayscale'}"
                                    />
                                    <div
                                        class="absolute -right-1 -bottom-1 rounded-full px-1.5 py-0.5 text-xs font-bold {achievement.status ===
                                        'unlocked'
                                            ? 'bg-amber-500 text-gray-900'
                                            : 'bg-gray-700 text-gray-300'}"
                                    >
                                        {achievement.rarity}%
                                    </div>
                                </div>
                                <div>
                                    <div
                                        class="flex items-center justify-between"
                                    >
                                        <h3 class="text-sm font-bold">
                                            {achievement.name}
                                        </h3>
                                        {#if achievement.status === "unlocked"}
                                            <span class="text-green-500">
                                                <Check class="h-4 w-4" />
                                            </span>
                                        {:else}
                                            <span class="text-gray-500">
                                                <Lock class="h-4 w-4" />
                                            </span>
                                        {/if}
                                    </div>
                                    <p class="mb-1 text-xs text-gray-400">
                                        {app.name}
                                    </p>
                                    <p
                                        class="line-clamp-2 text-xs text-gray-300"
                                    >
                                        {achievement.description}
                                    </p>
                                </div>
                            </div>
                            <div
                                class="flex items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400"
                            >
                                {#if achievement.status === "unlocked"}
                                    <span
                                        >Unlocked: {format(
                                            parseISO(achievement.unlocked),
                                            "MMM d, yyyy",
                                        )}</span
                                    >
                                {:else}
                                    <span>Locked</span>
                                {/if}
                                <a
                                    href={`/achievement/${achievement.id}`}
                                    class="text-amber-500 hover:text-amber-400"
                                >
                                    Details
                                </a>
                            </div>
                        </div>
                    </div> -->
            {/each}
        </div>
        {#if filteredAchievements.length === 0}
            <div
                class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center"
            >
                <Trophy class="mx-auto mb-4 h-12 w-12 text-gray-600" />
                <h3 class="mb-2 text-xl font-bold">No achievements found</h3>
                <p class="mx-auto max-w-md text-gray-400">
                    No achievements match your current filters. Try adjusting
                    your search or filter settings.
                </p>
            </div>
        {/if}
    </div>

    <!-- Friends Who Play -->
    <div class="mb-8">
        <h2 class="mb-6 text-2xl font-bold">Friends Who Play</h2>
        <!-- TODO island -->
        {#if isSignedIn}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {#await friends then f}
                    {#if f}
                        {@const { data: friends, error } = f.friends}
                        {#each friends?.values() as f}
                            {@const friend = f.user}
                            {@const owned = f.owned}
                            {@const completion =
                                (f.achievements.filter((a) => a.unlocked)
                                    .length /
                                    totalCount) *
                                100}
                            <div class="card p-4">
                                <div class="mb-4 flex items-center gap-3">
                                    <div class="relative">
                                        <img
                                            src={friend.avatar ||
                                                "/placeholder.svg"}
                                            alt={friend.displayName}
                                            width="48"
                                            height="48"
                                            class="rounded-full border border-gray-700"
                                        />
                                        <div
                                            class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-800 {friend.status !==
                                            SteamUserStatus.Offline
                                                ? 'bg-green-500'
                                                : 'bg-gray-500'}"
                                        ></div>
                                    </div>
                                    <div>
                                        <div class="font-medium">
                                            {friend.displayName}
                                        </div>
                                        <div class="text-xs text-gray-400">
                                            {#if owned.playtime}
                                                {(owned.playtime / 60).toFixed(
                                                    1,
                                                )} hours played
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div
                                        class="mb-1 flex items-center justify-between"
                                    >
                                        <div class="text-xs text-gray-400">
                                            Achievement Progress
                                        </div>
                                        <div class="text-xs font-medium">
                                            {completion.toFixed(0)}%
                                        </div>
                                    </div>
                                    <!-- <div class="h-1.5 rounded bg-gray-700">
                                <div
                                    class="h-full rounded-full {completion ===
                                    100
                                        ? 'bg-green-500'
                                        : completion > 75
                                          ? 'bg-amber-500'
                                          : 'bg-blue-500'}"
                                    style="width: {completion}%"
                                ></div>
                            </div> -->
                                    <Progress
                                        value={completion}
                                        max={100}
                                        meterBg={completion === 100
                                            ? "bg-amber-500"
                                            : "bg-blue-500"}
                                    ></Progress>
                                </div>
                                <div
                                    class="flex items-center justify-between text-xs text-gray-400"
                                >
                                    <span>
                                        <!-- {friend.achievements} / {app
                                        .achievementStats.total} achievements -->
                                    </span>
                                    <!-- <button
                                class="h-7 px-2 text-gray-400 hover:text-gray-100"
                            >
                                Compare
                            </button> -->
                                </div>
                            </div>
                        {/each}
                    {/if}
                {/await}
            </div>
        {/if}
    </div>

    <!-- Similar Games -->
    <div>
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
    </div>
</main>
