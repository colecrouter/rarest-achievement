<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import AchievementCards from "$lib/AchievementCards";
    import FriendCards from "$lib/FriendCards";
    import IndexError from "$lib/IndexError.svelte";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import { getRarity } from "$lib/rarity";
    import BookOpenText from "@lucide/svelte/icons/book-open-text";
    import NotebookText from "@lucide/svelte/icons/notebook-text";
    import Share from "@lucide/svelte/icons/share";
    import YouTube from "@lucide/svelte/icons/youtube";
    import { Tooltip } from "@skeletonlabs/skeleton-svelte";
    import Chart from "chart.js/auto";
    import Colors from "tailwindcss/colors";
    import Breadcrumbs from "../../../../Breadcrumbs.svelte";

    let { data } = $props();

    let {
        achievement,
        gameAchievements,
        app,
        friendsWithAchievement,
        articles,
    } = $derived(data);

    let rarity = $derived(getRarity(achievement.globalPercentage));

    let isSignedIn = true;

    let statsChart = $state<HTMLCanvasElement>();
    $effect(() => {
        const rarityChartData = [...(gameAchievements?.values() ?? [])]
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
            }));

        const style = getComputedStyle(document.documentElement);
        const rarityChartColors = rarityChartData.map((data) => {
            const rarity = getRarity(data.rarity);
            if (data.isCurrent) {
                return style.getPropertyValue(`--color-${rarity}-light`);
            }
            return style.getPropertyValue(`--color-${rarity}-dark`);
        });

        const currentIndex = rarityChartData.findIndex(
            (data) => data.isCurrent,
        );
        const selectedColor = rarityChartColors[currentIndex];

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
                        backgroundColor: rarityChartColors,
                        // @ts-expect-error custom field
                        selectedColor, // custom field for legend use
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
                plugins: {
                    legend: {
                        labels: {
                            generateLabels: (chart) => {
                                const dataset = chart.data.datasets[0];
                                return [
                                    {
                                        text: dataset?.label ?? "",
                                        fontColor: Colors.gray[300],
                                        // @ts-expect-error custom field
                                        fillStyle: dataset?.selectedColor ?? "",
                                    },
                                ];
                            },
                        },
                    },
                },
                onClick(_, elements) {
                    const first = elements[0];
                    if (!first) return;
                    const index = first.index;
                    const selectedAchievement = rarityChartData[index]?.id;
                    if (!selectedAchievement) return;
                    const selectedAchievementId = gameAchievements?.find(
                        (a) => a.id === selectedAchievement,
                    )?.id;
                    if (!selectedAchievementId) return;
                    goto(
                        `/game/${achievement.app.id}/achievement/${selectedAchievementId}`,
                        { keepFocus: true },
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
                    const selectedAchievementId = gameAchievements?.find(
                        (a) => a.id === selectedAchievement,
                    )?.id;
                    if (!selectedAchievementId) return;

                    chart.canvas.style.cursor = "pointer";
                },
            },
        });

        return () => chart.destroy();
    });

    let activeTab = $derived.by<"activeTab" | "stats" | "friends" | "articles">(
        () => {
            switch (page.url.searchParams.get("tab")) {
                case "friends":
                    return "friends";
                case "articles":
                    return "articles";
                default:
                    return "stats";
            }
        },
    );

    let viewHover = $state(false);
    let shareHover = $state(false);
</script>

<svelte:head>
    <title>{achievement.name} - {app.name}</title>
    <meta
        name="description"
        content={`View stats & guides for ${achievement.name} achievement in ${app.name} on Steam Vault` +
            (achievement.description ? `— ${achievement.description}` : ".")}
    />
    <link
        rel="canonical"
        href={`/game/${app.id}/achievement/${achievement.id}`}
    />
    <meta property="og:title" content={achievement.name} />
    <meta
        property="og:description"
        content={`View stats & guides for ${achievement.name} achievement in ${app.name} on Steam Vault` +
            (achievement.description ? `— ${achievement.description}` : ".")}
    />
    <meta property="og:image" content={achievement.icon} />
    <meta
        property="og:url"
        content={`/game/${app.id}/achievement/${achievement.id}`}
    />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
    <meta property="keywords" content="Steam, {app.name}, {achievement.name}" />
</svelte:head>

<main class="container mx-auto px-4 py-8">
    <Breadcrumbs path={data.breadcrumbs} />

    <div
        class="text border-surface-700 bg-surface-800 rounded-container mb-8 border"
    >
        <div
            class="to-surface-800 from-primary-900/30 rounded-container relative min-h-40 bg-gradient-to-r"
        >
            <div
                class="rounded-container absolute inset-0 bg-cover bg-center opacity-50"
                style:background-image={`url("${app.banner}")`}
            ></div>
            <div class="rounded-container absolute inset-0 overflow-hidden">
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
                            class="bg-{rarity}/20 rounded-container absolute -inset-1 blur-sm"
                        ></div>
                        <div
                            class="border-{rarity}/50 bg-surface-900 rounded-container relative border p-1"
                        >
                            <img
                                src={achievement.icon}
                                alt={achievement.name}
                                width="96"
                                height="96"
                                class="rounded"
                            />
                        </div>
                    </div>
                    <div>
                        <div class="mb-1 flex items-center gap-3">
                            <a href={"/game/" + achievement.app.id}>
                                <span class="text-surface-300"
                                    >{achievement.app.name}</span
                                >
                            </a>
                        </div>
                        <h1 class="mb-1 text-3xl font-bold">
                            {achievement.name}
                        </h1>
                        <p class="text-surface-200">
                            {achievement.description}
                        </p>
                    </div>
                </div>
                <!-- Tinted card with "ultra-rare 1.1% of players" -->
                <div
                    class="flex w-full flex-col items-center md:ml-auto md:items-end"
                >
                    <div
                        class="w-full text-center md:w-auto md:text-left border-{rarity}/30 bg-{rarity}/10 mb-2 rounded border px-4 py-2"
                    >
                        <div class="text-sm font-medium text-{rarity}">
                            {rarity}
                        </div>
                        <div class="text-2xl font-bold text-{rarity}-dark">
                            {achievement.globalPercentage}%
                        </div>
                        <div class="text-surface-300 text-xs">of players</div>
                    </div>
                    <div class="flex gap-2">
                        <Tooltip
                            open={viewHover}
                            onOpenChange={(e) => (viewHover = e.open)}
                            contentBase="bg-surface-100 p-4"
                            arrowBackground="!bg-surface-100"
                            contentBackground="rounded text-surface-900"
                            arrow
                        >
                            {#snippet content()}
                                View on Steam
                            {/snippet}
                            {#snippet trigger()}
                                <a
                                    href="https://steamcommunity.com/app/{achievement
                                        .app.id}/stats/{achievement.app
                                        .id}/achievements"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn preset-outlined-surface-500 p-2"
                                >
                                    <span hidden> View on Steam </span>
                                    <BookOpenText
                                        class="text-surface-500 h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </a>
                            {/snippet}
                        </Tooltip>
                        <button
                            class="btn preset-outlined-surface-500 p-2"
                            onclick={() =>
                                navigator.share({
                                    title: `${achievement.name} - ${app.name}`,
                                    text: `Check out this achievement!`,
                                    url: page.url.toString(),
                                })}
                        >
                            <span hidden>Share</span>
                            <Share
                                class="text-surface-500 h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
        {#if isSignedIn}
            <!-- <div class="flex items-center justify-between border-t border-surface-700 bg-surface-900/50 px-6 py-3">
                    <div class="flex items-center gap-3">
                        <span class="text-sm">
                            Unlocked on
                            <span class="font-medium text-surface-100">
                                {achievement.}
                            </span>
                        </span>
                    </div>
                    <div class="text-sm text-surface-300">
                        <span class="font-medium text-primary-500">{achievement.playersUnlocked.toLocaleString()}</span
                        >
                        out of {achievement.totalPlayers.toLocaleString()} players
                    </div>
                </div> -->
        {/if}
    </div>

    <div>
        <div class="border-surface-700 flex gap-4 border-b">
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
                onclick={() => goto("?tab=articles")}
                class="py-2"
                class:font-bold={activeTab === "articles"}>Tips & Guides</button
            >
        </div>

        <TransitionWrapper>
            {#if activeTab === "stats"}
                <Transition>
                    <section class="mt-6 space-y-8">
                        <div class="card p-4">
                            <h2 class="font-bold">
                                Achievement Rarity Comparison
                            </h2>
                            <p class="text-surface-300 text-sm">
                                How <i>{achievement.name}</i> compares to other
                                achievements in
                                <i>{achievement.app.name}</i>
                            </p>
                            <div class="max-h-[480px]">
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
                            <!-- <div class="rounded-container border border-surface-700 bg-surface-800 p-4">
                    <h2 class="font-bold">Achievement Activity</h2>
                    <p class="text-sm text-surface-300">
                        Your achievement unlocks around the time you
                        earned {achievement.displayName}
                        </p>
                        <div class="mb-4 flex items-center justify-between">
                            <button class="border border-surface-700 bg-surface-800 px-2 py-1 text-sm hover:bg-surface-700">
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
                                            <button class="border border-surface-700 bg-surface-800 px-2 py-1 text-sm hover:bg-surface-700">
                                            Next
                                            </button>
                                            </div>
                                            <div class="mt-1 grid grid-cols-7 gap-2">
                                                {#each activityData as day, index}
                                                <div class="flex aspect-square items-center justify-center rounded border text-center text-xs
                                                {day.count === 0 ? 'border-surface-700 bg-surface-800' : ''}
                                                {day.count === 1 ? 'bg-primary-900/30' : ''}
                                                {day.count === 2 ? 'bg-primary-800/40' : ''}
                                                {day.count === 3 ? 'bg-primary-700/50' : ''}
                                                {day.count === 4 ? 'bg-primary-600/60' : ''}
                                                {day.count >= 5 ? 'bg-primary-500/70' : ''}" title={`${format(
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

                        <div class="card p-4">
                            <h2 class="font-bold">
                                Other Achievements in {achievement.app.name}
                            </h2>
                            <p class="text-surface-300 text-sm">
                                Your progress on all achievements in this game
                            </p>
                            <div class="mt-4">
                                {#if gameAchievements}
                                    <AchievementCards
                                        achievements={[
                                            ...gameAchievements.values(),
                                        ]}
                                        secondary
                                    />
                                {/if}
                            </div>
                        </div>
                    </section>
                </Transition>
            {:else if activeTab === "friends"}
                <Transition>
                    <div class="mt-6 space-y-8">
                        {#await friendsWithAchievement then { error }}
                            {#if error}
                                <IndexError />
                            {/if}
                        {/await}
                        <FriendCards
                            secondary
                            data={friendsWithAchievement.then((d) => d.data)}
                        />
                    </div>
                </Transition>
            {:else if activeTab === "articles"}
                <Transition>
                    <section class="mt-6">
                        {#await articles}
                            <!-- Loading state -->
                            <div class="text-surface-300 p-4 text-center">
                                Loading tips & guides...
                            </div>
                        {:then res}
                            {#if res}
                                {@const { data: articleResult, error } = res}
                                {#if error}
                                    <div class="p-4 text-red-400">
                                        Error loading guides: {error.message}
                                    </div>
                                {:else}
                                    <section class="mt-6 space-y-8">
                                        <!-- Steam Community Guides Card -->
                                        <div class="card secondary p-4">
                                            <h2 class="font-bold">
                                                <NotebookText
                                                    class="text-primary-500 inline"
                                                />
                                                Steam Community Guides
                                            </h2>
                                            <p class="text-surface-300 text-sm">
                                                Official guides from the Steam
                                                Community for unlocking this
                                                achievement.
                                            </p>
                                            <div class="mt-4 space-y-4">
                                                {#each articleResult.articles as article}
                                                    <div class="card p-4">
                                                        <a
                                                            href="https://steamcommunity.com/sharedfiles/filedetails/?id={article.id}"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <div
                                                                class="flex gap-4"
                                                            >
                                                                <img
                                                                    src={article.thumbnail ||
                                                                        "/placeholder.svg"}
                                                                    alt={article.title}
                                                                    class="h-24 w-24 rounded object-cover"
                                                                />
                                                                <div>
                                                                    <div
                                                                        class="mb-1"
                                                                    >
                                                                        <h3
                                                                            class="text-primary-500 font-bold"
                                                                        >
                                                                            {article.title}
                                                                        </h3>
                                                                        <span
                                                                            class="text-surface-300 text-sm"
                                                                        >
                                                                            {article.author}
                                                                        </span>
                                                                    </div>
                                                                    <p
                                                                        class="text-surface-200 text-sm"
                                                                    >
                                                                        {article.description}
                                                                    </p>
                                                                    <!-- <a href={article.url} class="mt-2 inline-block text-xs text-primary-400 hover:underline">
                                                                Read More
                                                            </a> -->
                                                                </div>
                                                            </div>
                                                        </a>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                        <!-- YouTube Video Guides Card -->
                                        <div class="card secondary p-4">
                                            <h2 class="font-bold">
                                                <YouTube
                                                    class="inline text-red-500"
                                                />
                                                YouTube Video Guides
                                            </h2>
                                            <p class="text-surface-300 text-sm">
                                                Helpful video tutorials for
                                                unlocking this achievement.
                                            </p>
                                            <div class="mt-4 space-y-4">
                                                {#each articleResult.videos as video}
                                                    <div class="card p-4">
                                                        <a
                                                            href="https://www.youtube.com/watch?v={video.videoId}"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <div
                                                                class="flex flex-col gap-4 md:flex-row"
                                                            >
                                                                <div
                                                                    class="relative h-[135px] w-full flex-shrink-0 overflow-hidden rounded md:w-[240px]"
                                                                >
                                                                    <img
                                                                        src="https://i.ytimg.com/vi/{video.videoId}/mqdefault.jpg"
                                                                        alt={video.title}
                                                                        class="h-full w-full object-cover"
                                                                        width="240"
                                                                        height="135"
                                                                    />
                                                                </div>
                                                                <div
                                                                    class="flex-1"
                                                                >
                                                                    <h3
                                                                        class="text-primary-500 font-bold"
                                                                    >
                                                                        {video.title}
                                                                    </h3>
                                                                    <div
                                                                        class="mb-1 flex items-center gap-2"
                                                                    >
                                                                        <!-- <img src={video.channelAvatar ||
                                                                        "/placeholder.svg"} alt={video.channel} width="20" height="20" class="rounded-full" /> -->
                                                                        <span
                                                                            class="text-surface-300 text-sm"
                                                                        >
                                                                            {video.channel}
                                                                        </span>
                                                                        <!-- <span class="text-xs text-surface-500">
                                                                    {video.date}
                                                                </span> -->
                                                                    </div>
                                                                    <p
                                                                        class="text-surface-200 mb-3 text-sm"
                                                                    >
                                                                        {video.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </a>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    </section>
                                {/if}
                            {/if}
                        {:catch error}
                            <div class="p-4 text-red-400">
                                Error: {error.message}
                            </div>
                        {/await}
                    </section>
                </Transition>
            {/if}
        </TransitionWrapper>
    </div>

    <!-- <div class="mt-8 mb-8">
        <h2 class="mb-4 text-2xl font-bold">You Might Also Like</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {#each [...(gameAchievements?.values() ?? [])].slice(1, 5) as achievement}
                <div class="border border-surface-700 bg-surface-800 transition-colors hover:border-surface-600">
                    <div class="flex items-start gap-3 p-4">
                        <div class="relative flex-shrink-0">
                            <img src={achievement.icon || "/placeholder.svg"} alt={achievement.name} width="48" height="48" class="rounded border border-surface-700 bg-surface-900" />
                            <div class=" rounded-full bg-primary-500 px-1.5 py-0.5 text-xs font-bold text-surface-900">
                                {achievement.globalPercentage}%
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold">
                                {achievement.description}
                            </h3>
                            <p class="mb-1 text-xs text-surface-300">
                                {achievement.app.name}
                            </p>
                            <p class="line-clamp-2 text-xs text-surface-300">
                                {achievement.description}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between bg-surface-900 px-4 py-2 text-xs text-surface-300"
                    </div>
                </div>
            {/each}
        </div>
    </div> -->
</main>
