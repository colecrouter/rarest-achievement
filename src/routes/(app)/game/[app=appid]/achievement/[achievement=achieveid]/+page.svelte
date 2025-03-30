<script lang="ts">
    let { data } = $props();

    let { achievement, gameAchievements, app } = $derived(data);

    const friendsWithAchievement = [
        {
            id: 1,
            name: "GamerPro99",
            avatar: "/placeholder.svg?height=48&width=48",
            unlocked: "2023-04-20T10:15:00Z",
            status: "online",
        },
        {
            id: 2,
            name: "SpaceCommander",
            avatar: "/placeholder.svg?height=48&width=48",
            unlocked: "2023-05-02T14:30:00Z",
            status: "offline",
        },
    ];

    let isSignedIn = true;

    const rarityChartData = $derived(
        gameAchievements
            .slice()
            .sort((a, b) => a.globalPercentage - b.globalPercentage)
            .map((current) => ({
                name:
                    current.name.length > 20
                        ? `${current.name.substring(0, 20)}...`
                        : current.name,
                rarity: current.globalPercentage,
                isCurrent: current.id === achievement.id,
            })),
    );

    let activeTab = $state<"activeTab" | "stats" | "friends" | "tips">("stats");
</script>

<main class="container mx-auto px-4 py-8">
    <div class="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <a href="/dashboard" class="flex items-center hover:text-gray-100">
            Back to Dashboard
        </a>
        <span>/</span>
        <a href={"/game/" + achievement.app.id} class="hover:text-gray-100">
            {achievement.app.name}
        </a>
        <span>/</span>
        <span class="text-gray-100">{achievement.name}</span>
    </div>

    <div
        class="mb-8 overflow-hidden rounded-xl border border-gray-700 bg-gray-800"
    >
        <div
            class="relative h-40 bg-gradient-to-r from-amber-900/30 to-gray-800"
        >
            <div
                class="absolute inset-0 bg-cover bg-center opacity-50"
                style:background-image={`url("${app.banner}")`}
            ></div>
            <div
                class="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-amber-600"
            ></div>
            <div class="relative flex h-full items-center px-6">
                <div class="flex items-center gap-6">
                    <div class="relative">
                        <div
                            class="absolute -inset-1 rounded-lg bg-amber-500/20 blur-sm"
                        ></div>
                        <div
                            class="relative rounded-lg border border-amber-500/50 bg-gray-900 p-1"
                        >
                            <img
                                src={achievement.icon || "/placeholder.svg"}
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
                                <img
                                    src={app.icon || "/placeholder.svg"}
                                    alt={achievement.app.name}
                                    width="64"
                                    class="rounded-md"
                                />
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
                <div class="ml-auto flex flex-col items-end">
                    <div
                        class="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2"
                    >
                        <div class="text-sm font-medium text-amber-500">
                            Ultra Rare
                        </div>
                        <div class="text-2xl font-bold text-amber-400">
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
                onclick={() => (activeTab = "stats")}
                class="py-2"
                class:font-bold={activeTab === "stats"}>Statistics</button
            >
            <button
                onclick={() => (activeTab = "friends")}
                class="py-2"
                class:font-bold={activeTab === "friends"}>Friends</button
            >
            <button
                onclick={() => (activeTab = "tips")}
                class="py-2"
                class:font-bold={activeTab === "tips"}>Tips & Guides</button
            >
        </div>

        <script>
            let activeTab = "stats";
        </script>

        {#if activeTab === "stats"}
            <section class="mt-6 space-y-8">
                <div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
                    <h2 class="font-bold">Achievement Rarity Comparison</h2>
                    <p class="text-sm text-gray-400">
                        How {achievement.name} compares to other achievements in
                        {achievement.app}
                    </p>
                    <div class="h-[400px]">...chart goes here...</div>
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

                <div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
                    <h2 class="font-bold">
                        Other Achievements in {achievement.app}
                    </h2>
                    <p class="text-sm text-gray-400">
                        Your progress on all achievements in this game
                    </p>
                    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {#each gameAchievements as currentAchievement}
                            {@const isCurrent =
                                currentAchievement.id === achievement.id}
                            <div
                                class="flex items-start gap-3 rounded-lg p-3 {isCurrent
                                    ? 'border border-amber-500/30 bg-amber-500/10'
                                    : 'border border-gray-700 bg-gray-900/50 hover:bg-gray-700/30'}"
                            >
                                <img
                                    src={currentAchievement.icon ||
                                        "/placeholder.svg"}
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
                                            class="rounded-full px-2 py-0.5 text-xs font-medium {currentAchievement.globalPercentage <
                                            5
                                                ? 'bg-amber-500/10 text-amber-500'
                                                : currentAchievement.globalPercentage <
                                                    10
                                                  ? 'bg-orange-500/10 text-orange-500'
                                                  : 'bg-blue-500/10 text-blue-500'}"
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
        {:else if activeTab === "friends"}
            <section class="mt-6">
                {#if isSignedIn}
                    <div
                        class="rounded-lg border border-gray-700 bg-gray-800 p-4"
                    >
                        <div class="flex items-center justify-between">
                            <div>
                                <h2 class="font-bold">
                                    Friends Who Unlocked This Achievement
                                </h2>
                                <p class="text-sm text-gray-400">
                                    {friendsWithAchievement.length} of your friends
                                    have unlocked "{achievement.name}"
                                </p>
                            </div>
                            <button
                                class="border border-gray-700 bg-gray-800 px-2 py-1 text-sm hover:bg-gray-700"
                            >
                                Compare with Friends
                            </button>
                        </div>
                        <div class="mt-4 space-y-4">
                            <!-- {#each friendsWithAchievement as friend}
                                    <div
                                        class="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/50 p-3"
                                    >
                                        <div class="flex items-center gap-3">
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
                                                <div class="font-medium">
                                                    {friend.name}
                                                </div>
                                                <div
                                                    class="text-xs text-gray-400"
                                                >
                                                    Unlocked {format(
                                                        parseISO(
                                                            friend.unlocked,
                                                        ),
                                                        "MMMM d, yyyy",
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button
                                                class="text-sm text-gray-400 hover:text-gray-100"
                                                >View Profile</button
                                            >
                                            <button
                                                class="h-8 w-8 border border-gray-700 bg-gray-800 hover:bg-gray-700"
                                            ></button>
                                        </div>
                                    </div>
                                {/each} -->
                        </div>
                    </div>
                {:else}
                    <div
                        class="rounded-lg border border-gray-700 bg-gray-800 p-4 text-center"
                    >
                        <div
                            class="flex flex-col items-center justify-center py-12"
                        >
                            <h3 class="mb-2 text-xl font-bold">
                                Sign in to see friends
                            </h3>
                            <p class="mb-6 max-w-md text-gray-400">
                                Sign in to see which of your friends have
                                unlocked this achievement and compare your
                                progress.
                            </p>
                            <button
                                class="bg-amber-500 px-4 py-2 text-gray-900 hover:bg-amber-600"
                                >Sign In</button
                            >
                        </div>
                    </div>
                {/if}
            </section>
        {:else if activeTab === "tips"}
            <section class="mt-6">
                <div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
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
        {/if}
    </div>

    <div class="mt-8 mb-8">
        <h2 class="mb-4 text-2xl font-bold">You Might Also Like</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {#each gameAchievements.slice(1, 5) as achievement}
                <div
                    class="overflow-hidden border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
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
                                class="absolute -right-1 -bottom-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-gray-900"
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
