<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import IndexError from "$lib/IndexError.svelte";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import { getRarity } from "$lib/rarity";
    import Chart from "chart.js/auto";
    import { SteamUserStatus } from "lib";
    import TrophyIcon from "@lucide/svelte/icons/trophy";
    import Colors from "tailwindcss/colors";
    import Breadcrumbs from "../../../../Breadcrumbs.svelte";

    let { data } = $props();

    let { achievement, gameAchievements, app, friendsWithAchievement } =
        $derived(data);

    let rarity = $derived(getRarity(achievement.globalPercentage));

    let isSignedIn = true;

    const rarityChartData = $derived(
        [...(gameAchievements?.values() ?? [])]
            .slice()
            .sort((a, b) => a.globalPercentage - b.globalPercentage)
            .map((current) => ({
                name:
                    current.name.length > 20
                        ? `${current.name.substring(0, 20)}...`
                        : current.name,
                rarity: current.globalPercentage,
                id: current.id,
                isCurrent: current.id === achievement.id,
            })),
    );

    let statsChart = $state<HTMLCanvasElement>();
    $effect(() => {
        const ctx = statsChart?.getContext("2d");
        if (!ctx) return;

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: rarityChartData.map((data) => data.name),
                datasets: [
                    {
                        label: "This Achievement",
                        data: rarityChartData.map((data) => data.rarity),
                        backgroundColor: rarityChartData.map((data) =>
                            data.isCurrent
                                ? Colors.amber[500]
                                : Colors.gray[400],
                        ),
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                    x: {
                        ticks: {
                            color: Colors.gray[300],
                            maxRotation: 60,
                        },
                    },
                },
                color: Colors.gray[300],
                onClick(_, elements) {
                    const first = elements[0];
                    if (!first) return;
                    const index = first.index;
                    const selectedAchievement = rarityChartData[index]?.id;
                    if (!selectedAchievement) return;
                    const selectedAchievementId =
                        gameAchievements?.get(selectedAchievement)?.id;
                    if (!selectedAchievementId) return;
                    goto(
                        `/game/${achievement.app.id}/achievement/${selectedAchievementId}`,
                    );
                },
                onHover(event, elements, chart) {
                    // Reset
                    chart.canvas.style.cursor = "default";

                    const first = elements[0];
                    if (!first) return;
                    const index = first.index;
                    const selectedAchievement = rarityChartData[index]?.id;
                    if (!selectedAchievement) return;
                    const selectedAchievementId =
                        gameAchievements?.get(selectedAchievement)?.id;
                    if (!selectedAchievementId) return;

                    chart.canvas.style.cursor = "pointer";
                },
            },
        });

        return () => chart.destroy();
    });

    let activeTab = $derived.by<"activeTab" | "stats" | "friends" | "tips">(
        () => {
            switch (page.url.searchParams.get("tab")) {
                case "friends":
                    return "friends";
                case "tips":
                    return "tips";
                default:
                    return "stats";
            }
        },
    );
</script>

<svelte:head>
    <title>{achievement.name} - {app.name}</title>
    <meta
        name="description"
        content={`View the ${achievement.name} achievement for ${app.name}.`}
    />
    <link
        rel="canonical"
        href={`/game/${app.id}/achievement/${achievement.id}`}
    />
    <meta property="og:title" content={achievement.name} />
    <meta property="og:description" content={achievement.description} />
    <meta property="og:image" content={achievement.icon} />
    <meta
        property="og:url"
        content={`/game/${app.id}/achievement/${achievement.id}`}
    />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
</svelte:head>

<main class="container mx-auto px-4 py-8">
    <Breadcrumbs path={data.breadcrumbs} />

    <div class="text mb-8 rounded-xl border border-gray-700 bg-gray-800">
        <div
            class="relative min-h-40 rounded-xl bg-gradient-to-r from-amber-900/30 to-gray-800"
        >
            <div
                class="absolute inset-0 rounded-xl bg-cover bg-center opacity-50"
                style:background-image={`url("${app.banner}")`}
            ></div>
            <div class="absolute inset-0 overflow-hidden rounded-xl">
                <div
                    class="from-{rarity} to-{rarity}-dark absolute top-0 left-0 h-1 w-full bg-gradient-to-r"
                ></div>
            </div>
            <div
                class="relative flex flex-col items-center px-6 py-4 md:flex-row"
            >
                <div class="mb-2 flex items-center gap-6">
                    <div class="relative min-w-[96px]">
                        <div
                            class="bg-{rarity}/20 absolute -inset-1 rounded-lg blur-sm"
                        ></div>
                        <div
                            class="border-{rarity}/50 relative rounded-lg border bg-gray-900 p-1"
                        >
                            <img
                                src={achievement.icon}
                                alt={achievement.name}
                                width="96"
                                height="96"
                                class="rounded-md"
                            />
                        </div>
                    </div>
                    <div>
                        <div class="mb-1 flex items-center gap-3">
                            <a href={"/game/" + achievement.app.id}>
                                <span class="text-gray-300"
                                    >{achievement.app.name}</span
                                >
                            </a>
                        </div>
                        <h1 class="mb-1 text-3xl font-bold">
                            {achievement.name}
                        </h1>
                        <p class="text-gray-300">
                            {achievement.description}
                        </p>
                    </div>
                </div>
                <!-- Tinted card with "ultra-rare 1.1% of players" -->
                <div
                    class="flex w-full flex-col items-center md:ml-auto md:items-end"
                >
                    <div
                        class="w-full text-center md:w-auto md:text-left border-{rarity}/30 bg-{rarity}/10 mb-2 rounded-lg border px-4 py-2"
                    >
                        <div class="text-sm font-medium text-{rarity}">
                            {rarity}
                        </div>
                        <div class="text-2xl font-bold text-{rarity}-dark">
                            {achievement.globalPercentage}%
                        </div>
                        <div class="text-xs text-gray-400">of players</div>
                    </div>
                    <div class="flex gap-2">
                        <button
                            class="h-8 w-8 border border-gray-700 bg-gray-800 hover:bg-gray-700"
                        ></button>
                        <button
                            class="h-8 w-8 border border-gray-700 bg-gray-800 hover:bg-gray-700"
                        ></button>
                    </div>
                </div>
            </div>
        </div>
        {#if isSignedIn}
            <!-- <div
                    class="flex items-center justify-between border-t border-gray-700 bg-gray-900/50 px-6 py-3"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-sm">
                            Unlocked on
                            <span class="font-medium text-gray-100">
                                {achievement.}
                            </span>
                        </span>
                    </div>
                    <div class="text-sm text-gray-400">
                        <span class="font-medium text-amber-500"
                            >{achievement.playersUnlocked.toLocaleString()}</span
                        >
                        out of {achievement.totalPlayers.toLocaleString()} players
                    </div>
                </div> -->
        {/if}
    </div>

    <div>
        <div class="flex gap-4 border-b border-gray-700">
            <button
                onclick={() => goto("?tab=stats")}
                class="py-2"
                class:font-bold={activeTab === "stats"}>Statistics</button
            >
            <button
                onclick={() => goto("?tab=friends")}
                class="py-2"
                class:font-bold={activeTab === "friends"}>Friends</button
            >
            <button
                onclick={() => goto("?tab=tips")}
                class="py-2"
                class:font-bold={activeTab === "tips"}>Tips & Guides</button
            >
        </div>

        <TransitionWrapper>
            {#if activeTab === "stats"}
                <Transition>
                    <section class="mt-6 space-y-8">
                        <div
                            class="rounded-lg border border-gray-700 bg-gray-800 p-4"
                        >
                            <h2 class="font-bold">
                                Achievement Rarity Comparison
                            </h2>
                            <p class="text-sm text-gray-400">
                                How <i>{achievement.name}</i> compares to other
                                achievements in
                                <i>{achievement.app.name}</i>
                            </p>
                            <div>
                                <!-- Need to key, chartjs not updated when soft-navigating to a different achievement page -->
                                {#key achievement}
                                    <canvas
                                        bind:this={statsChart}
                                        class="h-full w-full"
                                    ></canvas>
                                {/key}
                            </div>
                        </div>

                        {#if isSignedIn}
                            <!-- <div
                    class="rounded-lg border border-gray-700 bg-gray-800 p-4"
                    >
                    <h2 class="font-bold">Achievement Activity</h2>
                    <p class="text-sm text-gray-400">
                        Your achievement unlocks around the time you
                        earned {achievement.displayName}
                        </p>
                        <div class="mb-4 flex items-center justify-between">
                            <button
                            class="border border-gray-700 bg-gray-800 px-2 py-1 text-sm hover:bg-gray-700"
                            >
                            Previous
                            </button>
                            <div class="flex items-center gap-2 text-sm">
                                <span>
                                    {format(activityData[0].date, "MMM d")} -
                                    {format(
                                        activityData[
                                            activityData.length - 1
                                            ].date,
                                            "MMM d, yyyy",
                                            )}
                                            </span>
                                            </div>
                                            <button
                                            class="border border-gray-700 bg-gray-800 px-2 py-1 text-sm hover:bg-gray-700"
                                            >
                                            Next
                                            </button>
                                            </div>
                                            <div class="mt-1 grid grid-cols-7 gap-2">
                                                {#each activityData as day, index}
                                                <div
                                                class="flex aspect-square items-center justify-center rounded-md border text-center text-xs
                                                {day.count === 0 ? 'border-gray-700 bg-gray-800' : ''}
                                                {day.count === 1 ? 'bg-amber-900/30' : ''}
                                                {day.count === 2 ? 'bg-amber-800/40' : ''}
                                                {day.count === 3 ? 'bg-amber-700/50' : ''}
                                                {day.count === 4 ? 'bg-amber-600/60' : ''}
                                                {day.count >= 5 ? 'bg-amber-500/70' : ''}"
                                                title={`${format(
                                                    day.date,
                                                    "MMMM d, yyyy",
                                                    )}\n${day.count} achievement${day.count !== 1 ? "s" : ""} unlocked${day.isUnlockDay ? '\nYou unlocked "' + achievement.displayName + '" on this day' : ""}`}
                                                    >
                                                    {day.count}
                                                    </div>
                                                    {/each}
                                                    </div>
                                                    </div> -->
                        {/if}

                        <div
                            class="rounded-lg border border-gray-700 bg-gray-800 p-4"
                        >
                            <h2 class="font-bold">
                                Other Achievements in {achievement.app.name}
                            </h2>
                            <p class="text-sm text-gray-400">
                                Your progress on all achievements in this game
                            </p>
                            <div
                                class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
                            >
                                {#each gameAchievements?.values() ?? [] as currentAchievement}
                                    {@const isCurrent =
                                        currentAchievement.id ===
                                        achievement.id}
                                    {@const color = getRarity(
                                        currentAchievement.globalPercentage,
                                    )}
                                    <div
                                        class="flex items-start gap-3 rounded-lg p-3 {isCurrent
                                            ? 'border border-amber-500/30 bg-amber-500/10'
                                            : 'border border-gray-700 bg-gray-900/50 hover:bg-gray-700/30'}"
                                    >
                                        <img
                                            src={currentAchievement.icon}
                                            alt={currentAchievement.name}
                                            width="48"
                                            height="48"
                                            class="rounded-md {isCurrent
                                                ? 'border border-amber-500'
                                                : 'border border-gray-700'}"
                                        />
                                        <div class="flex-1">
                                            <div
                                                class="flex items-center justify-between"
                                            >
                                                <h3
                                                    class={isCurrent
                                                        ? "font-bold text-amber-400"
                                                        : "font-bold text-gray-100"}
                                                >
                                                    {currentAchievement.name}
                                                </h3>
                                                <div
                                                    class="rounded-full px-2 py-0.5 text-xs font-medium bg-{color}/20 text-{color}-light"
                                                >
                                                    {currentAchievement.globalPercentage}%
                                                </div>
                                            </div>
                                            <p
                                                class="mt-1 line-clamp-2 text-xs text-gray-400"
                                            >
                                                {currentAchievement.description}
                                            </p>
                                            {#if isSignedIn}
                                                <!-- <div
                            class="mt-1 text-xs text-gray-500"
                            >
                            Unlocked on {format(
                                parseISO(
                                    achievement.unlocked,
                                    ),
                                    "MMM d, yyyy",
                                    )}
                                    </div> -->
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </section>
                </Transition>
            {:else if activeTab === "friends"}
                <Transition>
                    <section class="container mt-6">
                        <div class="card min-h-[300px] p-4">
                            <TransitionWrapper>
                                {#await friendsWithAchievement}
                                    <div class="flex w-full flex-col gap-2">
                                        {#each new Array(4)}
                                            <div
                                                class="flex w-full items-center gap-2"
                                            >
                                                <div
                                                    class="aspect-square h-16 animate-pulse rounded-full bg-gray-600"
                                                ></div>
                                                <div
                                                    class="flex w-full grow flex-col gap-2"
                                                >
                                                    <div
                                                        class="h-4 animate-pulse rounded bg-gray-600"
                                                    ></div>
                                                    <div
                                                        class="grid grid-cols-2 gap-2"
                                                    >
                                                        <div
                                                            class="h-4 animate-pulse rounded bg-gray-600"
                                                        ></div>
                                                        <div
                                                            class="h-4 animate-pulse rounded bg-gray-600"
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {:then { data: friends, error }}
                                    <Transition>
                                        {#if error}
                                            <IndexError />
                                        {/if}

                                        {#if friends !== null}
                                            <div
                                                class="flex items-center justify-between"
                                            >
                                                <div>
                                                    <h2 class="font-bold">
                                                        Friends Who Unlocked
                                                        This Achievement
                                                    </h2>
                                                    <p
                                                        class="text-sm text-gray-400"
                                                    >
                                                        {friends?.length} of your
                                                        friends have unlocked "{achievement.name}"
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-4 space-y-4">
                                                {#each friends as f}
                                                    {@const {
                                                        friend,
                                                        achievement,
                                                    } = f}
                                                    <div
                                                        class="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/50 p-3"
                                                    >
                                                        <div
                                                            class="flex items-center gap-3"
                                                        >
                                                            <div
                                                                class="relative"
                                                            >
                                                                <img
                                                                    src={friend.avatar ||
                                                                        "/placeholder.svg"}
                                                                    alt={friend.displayName}
                                                                    width="48"
                                                                    height="48"
                                                                    class="rounded-full border border-gray-700"
                                                                />
                                                                <div
                                                                    class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-800 {friend.status ===
                                                                    SteamUserStatus.Online
                                                                        ? 'bg-green-500'
                                                                        : 'bg-gray-500'}"
                                                                ></div>
                                                            </div>
                                                            <div>
                                                                <div
                                                                    class="font-medium"
                                                                >
                                                                    {friend.displayName}
                                                                </div>
                                                                <div
                                                                    class="text-xs text-gray-400"
                                                                >
                                                                    Unlocked {achievement?.unlocked?.toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div
                                                            class="flex items-center gap-2"
                                                        >
                                                            <button
                                                                class="text-sm text-gray-400 hover:text-gray-100"
                                                                >View Profile</button
                                                            >
                                                            <button
                                                                class="h-8 w-8 border border-gray-700 bg-gray-800 hover:bg-gray-700"
                                                            ></button>
                                                        </div>
                                                    </div>
                                                {/each}
                                                {#if friends.length === 0}
                                                    <div
                                                        class="mb-4 flex flex-col items-center justify-center gap-2"
                                                    >
                                                        <TrophyIcon
                                                            class="h-32 w-32 text-gray-400"
                                                        />
                                                        <div
                                                            class="text-sm text-gray-400"
                                                        >
                                                            No friends have
                                                            unlocked this
                                                            achievement yet.
                                                        </div>
                                                    </div>
                                                {/if}
                                            </div>
                                        {:else}
                                            <div
                                                class="flex flex-col items-center justify-center py-12"
                                            >
                                                <h3
                                                    class="mb-2 text-xl font-bold"
                                                >
                                                    Sign in to see friends
                                                </h3>
                                                <p
                                                    class="mb-6 max-w-md text-gray-400"
                                                >
                                                    Sign in to see which of your
                                                    friends have unlocked this
                                                    achievement.
                                                </p>
                                                <button
                                                    class="btn preset-filled-primary-500 px-4 py-2"
                                                    >Sign In</button
                                                >
                                            </div>
                                        {/if}
                                    </Transition>
                                {/await}
                            </TransitionWrapper>
                        </div>
                    </section>
                </Transition>
            {:else if activeTab === "tips"}
                <Transition>
                    <section class="container mt-6">
                        <div
                            class="rounded-lg border border-gray-700 bg-gray-800 p-4"
                        >
                            <h2 class="font-bold">Tips & Strategies</h2>
                            <p class="text-sm text-gray-400">
                                Community guides for unlocking "{achievement.name}"
                            </p>
                            <div
                                class="mb-6 flex gap-3 rounded-lg border border-gray-700 bg-gray-900/50 p-4"
                            >
                                <div>
                                    <h3 class="mb-1 font-medium">
                                        Achievement Description
                                    </h3>
                                    <p class="text-sm text-gray-300">
                                        {achievement.description}
                                    </p>
                                </div>
                            </div>
                            <button
                                class="w-full bg-gray-700 py-2 text-gray-100 hover:bg-gray-600"
                                >View All Tips & Guides</button
                            >
                        </div>
                    </section>
                </Transition>
            {/if}
        </TransitionWrapper>
    </div>

    <div class="mt-8 mb-8">
        <h2 class="mb-4 text-2xl font-bold">You Might Also Like</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {#each [...(gameAchievements?.values() ?? [])].slice(1, 5) as achievement}
                <div
                    class="border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
                >
                    <div class="flex items-start gap-3 p-4">
                        <div class="relative flex-shrink-0">
                            <img
                                src={achievement.icon || "/placeholder.svg"}
                                alt={achievement.name}
                                width="48"
                                height="48"
                                class="rounded-md border border-gray-700 bg-gray-900"
                            />
                            <div
                                class=" rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-gray-900"
                            >
                                {achievement.globalPercentage}%
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold">
                                {achievement.description}
                            </h3>
                            <p class="mb-1 text-xs text-gray-400">
                                {achievement.app.name}
                            </p>
                            <p class="line-clamp-2 text-xs text-gray-300">
                                {achievement.description}
                            </p>
                        </div>
                    </div>
                    <div
                        class="flex items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400"
                    >
                        <!-- <span
                                >Unlocked: {format(
                                    parseISO(achievement.unlocked),
                                    "MMM d, yyyy",
                                )}</span
                            >
                            <a
                                href={`/achievement/${achievement.internalName}`}
                                class="text-amber-500 hover:text-amber-400"
                                >Details</a
                            > -->
                    </div>
                </div>
            {/each}
        </div>
    </div>
</main>
