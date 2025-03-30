<script lang="ts">
    import {
        ArrowLeft,
        Calendar,
        Check,
        Clock,
        Filter,
        GamepadIcon,
        Lock,
        Search,
        Server,
        SortAsc,
        Star,
        Trophy,
        User,
    } from "lucide-svelte";

    let isSignedIn = true;
    let achievementFilter: "all" | "unlocked" | "locked" = "all";
    let searchQuery = "";
    let sortOrder: "name" | "rarity" | "date" = "rarity";
    let sortDirection: "asc" | "desc" = "asc";

    let { data } = $props();
    let { app, achievements } = $derived(data);

    // const app = {
    //     id: "mass-effect-2",
    //     name: "Mass Effect 2",
    //     developer: "BioWare",
    //     publisher: "Electronic Arts",
    //     releaseDate: "2010-01-26T00:00:00Z",
    //     lastPlayed: "2023-05-15T14:32:00Z",
    //     playtime: 86,
    //     icon: "/placeholder.svg?height=128&width=128",
    //     banner: "/placeholder.svg?height=400&width=1200",
    //     description:
    //         "Mass Effect 2 is an action role-playing video game developed by BioWare and published by Electronic Arts...",
    //     achievementStats: {
    //         total: 50,
    //         unlocked: 42,
    //         completion: 84,
    //         rarityDistribution: [
    //             { name: "Common (>50%)", value: 15, color: "#60A5FA" },
    //             { name: "Uncommon (10-50%)", value: 18, color: "#34D399" },
    //             { name: "Rare (5-10%)", value: 7, color: "#F59E0B" },
    //             { name: "Ultra Rare (<5%)", value: 10, color: "#EF4444" },
    //         ],
    //         recentUnlocks: [
    //             {
    //                 id: "against-all-odds",
    //                 name: "Against All Odds",
    //                 description:
    //                     "Complete the final mission on Insane difficulty without any squad member dying",
    //                 rarity: 0.8,
    //                 icon: "/placeholder.svg?height=48&width=48",
    //                 unlocked: "2023-05-15T14:32:00Z",
    //             },
    //             {
    //                 id: "insanity",
    //                 name: "Insanity",
    //                 description: "Complete the game on Insanity difficulty",
    //                 rarity: 1.2,
    //                 icon: "/placeholder.svg?height=48&width=48",
    //                 unlocked: "2023-05-14T20:15:00Z",
    //             },
    //             {
    //                 id: "survivor",
    //                 name: "Survivor",
    //                 description:
    //                     "Complete the Suicide Mission with all squad members surviving",
    //                 rarity: 15.4,
    //                 icon: "/placeholder.svg?height=48&width=48",
    //                 unlocked: "2023-05-13T13:40:00Z",
    //             },
    //         ],
    //     },
    // };
    const friendsWhoPlay = [
        {
            id: 1,
            name: "GamerPro99",
            avatar: "/placeholder.svg?height=48&width=48",
            status: "online",
            achievements: 45,
            completion: 90,
            lastPlayed: "2023-06-01T10:15:00Z",
        },
        // ...other friends...
    ];

    let filteredAchievements = $derived(
        achievements
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
                    !achievement.displayName
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
                        ? a.displayName.localeCompare(b.displayName)
                        : b.displayName.localeCompare(a.displayName);

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
    <img
        src={app.banner || "/placeholder.svg"}
        alt={app.name}
        class="h-full w-full object-cover"
    />
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
                        src={app.icon || "/placeholder.svg"}
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
                <a href="steam://run/{app.appId}">
                    <button class="btn preset-filled-primary-500 group flex">
                        <GamepadIcon
                            class="transition-all group-hover:rotate-12"
                        />
                        Play on Steam
                    </button>
                </a>
                <a href="https://steamdb.info/app/{app.appId}/" target="_blank">
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

    <!-- Game Overview -->
    <div class="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <!-- Achievement Progress -->
        <!-- <div class="border border-gray-700 bg-gray-800 p-4 lg:col-span-2"> -->
        <h2 class="mb-1 text-xl font-bold">Achievement Progress</h2>
        <!-- <p class="mb-4">
            You've unlocked {app.achievementStats.unlocked} of {app
                .achievementStats.total} achievements
        </p> -->
        <div class="mb-6">
            <!-- <div class="mb-2 flex items-center justify-between">
                <span class="text-sm text-gray-400">Completion</span>
                <span class="text-sm font-medium"
                    >{app.achievementStats.completion}%</span
                >
            </div>
            <div class="h-2 rounded bg-gray-700">
                <div
                    class="h-full rounded bg-amber-500"
                    style="width: {app.achievementStats.completion}%"
                ></div>
            </div> -->
        </div>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="h-[200px]">
                <!-- For the pie chart, you may use a Svelte charting library or embed Recharts via a web component -->
                <!-- ...chart code... -->
            </div>
            <!-- <div>
                <h3 class="mb-3 text-lg font-medium">Recent Unlocks</h3>
                <div class="space-y-3">
                    {#each app.achievementStats.recentUnlocks as achievement}
                        <a
                            href={`/achievement/${achievement.id}`}
                            class="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900/50 p-2 hover:bg-gray-700/30"
                        >
                            <img
                                src={achievement.icon || "/placeholder.svg"}
                                alt={achievement.name}
                                width="36"
                                height="36"
                                class="rounded-md border border-gray-700"
                            />
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between">
                                    <h4 class="truncate text-sm font-medium">
                                        {achievement.name}
                                    </h4>
                                    <div
                                        class="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-gray-900"
                                    >
                                        {achievement.rarity}%
                                    </div>
                                </div>
                                <div class="mt-0.5 text-xs text-gray-400">
                                    {format(
                                        parseISO(achievement.unlocked),
                                        "MMM d, yyyy",
                                    )}
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>
            </div> -->
        </div>
    </div>

    <!-- Game Info -->
    <div class="border border-gray-700 bg-gray-800 p-4">
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
                        {app.releaseDate?.toLocaleDateString() ?? "Unreleased"}
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
                    href={`https://store.steampowered.com/app/${app.appId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <button class="btn preset-outlined-surface-500 w-full">
                        View on Steam
                    </button>
                </a>
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
                    <!-- Filter Dropdown -->
                    <div>
                        <button
                            on:click={() =>
                                (achievementFilter =
                                    achievementFilter === "all"
                                        ? "unlocked"
                                        : achievementFilter === "unlocked"
                                          ? "locked"
                                          : "all")}
                            class="flex items-center gap-2 border-gray-700 bg-gray-800 px-3 py-2 hover:bg-gray-700"
                        >
                            <Filter class="h-4 w-4" />
                            <span
                                >{achievementFilter === "all"
                                    ? "All"
                                    : achievementFilter}</span
                            >
                        </button>
                    </div>
                    <!-- Sort Dropdown -->
                    <div>
                        <button
                            on:click={() => {
                                if (sortOrder === "name") {
                                    sortDirection =
                                        sortDirection === "asc"
                                            ? "desc"
                                            : "asc";
                                } else {
                                    sortOrder = "name";
                                    sortDirection = "asc";
                                }
                            }}
                            class="flex items-center gap-2 border-gray-700 bg-gray-800 px-3 py-2 hover:bg-gray-700"
                        >
                            <SortAsc class="h-4 w-4" />
                            <span>Sort</span>
                        </button>
                    </div>
                </div>
            </div>

            <div
                class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
                {#each filteredAchievements as achievement}
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
                    <h3 class="mb-2 text-xl font-bold">
                        No achievements found
                    </h3>
                    <p class="mx-auto max-w-md text-gray-400">
                        No achievements match your current filters. Try
                        adjusting your search or filter settings.
                    </p>
                </div>
            {/if}
        </div>

        <!-- Friends Who Play -->
        {#if isSignedIn}
            <div class="mb-8">
                <h2 class="mb-6 text-2xl font-bold">Friends Who Play</h2>
                <div
                    class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
                >
                    {#each friendsWhoPlay as friend}
                        <div class="border border-gray-700 bg-gray-800 p-4">
                            <div class="mb-4 flex items-center gap-3">
                                <div class="relative">
                                    <img
                                        src={friend.avatar ||
                                            "/placeholder.svg"}
                                        alt={friend.name}
                                        width="48"
                                        height="48"
                                        class="rounded-full border border-gray-700"
                                    />
                                    <div
                                        class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-800 {friend.status ===
                                        'online'
                                            ? 'bg-green-500'
                                            : 'bg-gray-500'}"
                                    ></div>
                                </div>
                                <div>
                                    <div class="font-medium">{friend.name}</div>
                                    <div class="text-xs text-gray-400">
                                        <!-- Last played {format(
                                            parseISO(friend.lastPlayed),
                                            "MMM d",
                                        )} -->
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
                                        {friend.completion}%
                                    </div>
                                </div>
                                <div class="h-1.5 rounded bg-gray-700">
                                    <div
                                        class="h-full rounded-full {friend.completion ===
                                        100
                                            ? 'bg-green-500'
                                            : friend.completion > 75
                                              ? 'bg-amber-500'
                                              : 'bg-blue-500'}"
                                        style="width: {friend.completion}%"
                                    ></div>
                                </div>
                            </div>
                            <div
                                class="flex items-center justify-between text-xs text-gray-400"
                            >
                                <span>
                                    <!-- {friend.achievements} / {app
                                        .achievementStats.total} achievements -->
                                </span>
                                <button
                                    class="h-7 px-2 text-gray-400 hover:text-gray-100"
                                >
                                    Compare
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

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
    </div>
</main>
