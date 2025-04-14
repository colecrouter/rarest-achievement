<script lang="ts">
    // Import icons from lucide-svelte
    import {
        Award,
        ChevronRight,
        Crown,
        Search,
        TrendingUp,
        Trophy,
        Users,
    } from "lucide-svelte";
    import { fly } from "svelte/transition";
    import AchievementCard from "./user/[id=userid]/AchievementCard.svelte";

    let { data } = $props();

    // Stats for the home page
    const stats = [
        { label: "Tracked Achievements", value: "1.2M+", icon: Trophy },
        { label: "Active Users", value: "250K+", icon: Users },
        { label: "Games Supported", value: "12,000+", icon: TrendingUp },
    ];

    const textCards = [
        {
            title: "Track Your Achievements",
            description:
                "View achievements for all your games in one place. See how you compare to others.",
            icon: Award,
        },
        {
            title: "Find Key Insights",
            description:
                "Discover more games & achievements. Find guides, stats, and more.",
            icon: Search,
        },
        {
            title: "Connect With Others",
            description:
                "Find other achievement hunters, compare stats, and make new friends.",
            icon: Users,
        },
    ] satisfies Array<{
        title: string;
        description: string;
        icon: typeof Trophy;
    }>;

    let animate = $state(false);
    $effect(() => {
        animate = true;
    });
</script>

<svelte:head>
    <title>Steam Vault - Showcase Your Achievements</title>
    <meta
        name="description"
        content="Track, display, and share your most impressive gaming accomplishments. See how you stack up against other players with Steam Vault."
    />
    <meta
        name="keywords"
        content="Steam, achievements, gaming, showcase, leaderboard"
    />
    <meta
        property="og:title"
        content="Steam Vault - Showcase Your Achievements"
    />
    <meta
        property="og:description"
        content="Track, display, and share your most impressive gaming accomplishments. See how you stack up against other players with Steam Vault."
    />
    <link rel="canonical" href="/" />
</svelte:head>

<main>
    <!-- Hero Section -->
    <section class="relative overflow-hidden py-20">
        <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
        ></div>
        <div class="container mx-auto px-4">
            <div class="grid items-center gap-8 md:grid-cols-2">
                <div class="space-y-6">
                    <h1
                        class="text-4xl leading-tight font-bold md:text-5xl lg:text-6xl"
                    >
                        Showcase Your Rarest Achievements on Steam
                    </h1>
                    <p class="max-w-lg text-lg text-gray-300">
                        Track, display, and share your most impressive gaming
                        accomplishments. See how you stack up against other
                        players with Steam Vault.
                    </p>
                    {@render buttons()}
                </div>
                <div class="relative">
                    <div
                        class="absolute -inset-4 rounded-full bg-amber-500/5 blur-3xl"
                    ></div>
                    <div
                        class="relative rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl"
                    >
                        <div class="absolute -top-6 -right-6">
                            <div class="relative">
                                <div
                                    class="absolute inset-0 animate-pulse rounded-full bg-amber-500/20"
                                ></div>
                                <Crown
                                    class="relative z-10 h-16 w-16 p-2 text-amber-500"
                                />
                            </div>
                        </div>
                        <div class="mb-6 flex items-center gap-4">
                            <Trophy class="h-8 w-8 text-amber-500" />
                            <h3 class="text-xl font-bold">
                                Top Achievement Hunters
                            </h3>
                        </div>
                        <div class="space-y-4">
                            {#each [1, 2, 3] as rank}
                                <div
                                    class="flex items-center gap-3 rounded-lg bg-gray-900/50 p-3"
                                >
                                    <div
                                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 font-bold text-amber-500"
                                    >
                                        {rank}
                                    </div>
                                    <img
                                        src="/placeholder.svg"
                                        alt="User avatar"
                                        width="40"
                                        height="40"
                                        class="rounded-full border border-gray-700"
                                    />
                                    <div>
                                        <div class="font-medium">
                                            Player{rank}
                                        </div>
                                        <div class="text-xs text-gray-400">
                                            {Math.floor(Math.random() * 500) +
                                                500} rare achievements
                                        </div>
                                    </div>
                                    <div class="ml-auto">
                                        <button class="h-8 w-8 p-0">
                                            <ChevronRight class="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Example achievements -->
    <section class="py-16">
        <div class="container mx-auto px-4">
            <h2 class="mb-8 text-center text-3xl font-bold">
                Explore Your Achievements
            </h2>
            <div
                class="grid grid-cols-1 gap-6 pt-4 transition-all md:grid-cols-3"
            >
                {#each data.showcase2 as achievement, i}
                    {#if animate}
                        <div
                            transition:fly={{
                                y: 20,
                                duration: 300,
                                delay: i * 100,
                            }}
                            class="rounded-xl shadow-amber-500/30 even:shadow-lg md:even:-translate-y-4"
                        >
                            <AchievementCard {achievement} />
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section class="bg-gray-900/30 py-16">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each stats as stat}
                    <div class="flex flex-col items-center text-center">
                        <div class="mb-4 rounded-full bg-amber-500/10 p-4">
                            <stat.icon class="h-8 w-8 text-amber-500" />
                        </div>
                        <div class="mb-2 text-4xl font-bold">{stat.value}</div>
                        <div class="text-gray-400">{stat.label}</div>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- Featured Achievements -->
    <section class="py-16">
        <div class="container mx-auto px-4">
            <div
                class="mb-10 flex flex-col items-start justify-between md:flex-row md:items-center"
            >
                <div>
                    <h2 class="mb-2 text-3xl font-bold">
                        Featured Rare Achievements
                    </h2>
                    <p class="max-w-2xl text-gray-400">
                        Check out some of the rarest achievements unlocked by
                        our community members.
                    </p>
                </div>
                <a href="/dashboard">
                    <button
                        class="mt-4 flex items-center gap-2 rounded border border-gray-700 px-4 py-2 hover:bg-gray-800 md:mt-0"
                    >
                        View All
                        <ChevronRight class="ml-2 h-4 w-4" />
                    </button>
                </a>
            </div>

            <!-- <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                {#each featuredAchievements as achievement}
                    <div
                        class="overflow-hidden rounded border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
                    >
                        <div
                            class="flex items-start justify-between border-b border-gray-700 p-4"
                        >
                            <div class="flex items-center gap-3">
                                <img
                                    src={achievement.icon}
                                    alt={achievement.name}
                                    width="48"
                                    height="48"
                                    class="rounded-md border border-gray-700 bg-gray-900"
                                />
                                <div>
                                    <div class="text-lg font-bold">
                                        {achievement.name}
                                    </div>
                                    <div class="text-sm text-gray-400">
                                        {achievement.game}
                                    </div>
                                </div>
                            </div>
                            <div
                                class="rounded-full bg-amber-500 px-2 py-1 text-xs font-bold text-gray-900"
                            >
                                {achievement.rarity}%
                            </div>
                        </div>

                        <div class="p-4">
                            <p class="text-sm text-gray-300">
                                {achievement.description}
                            </p>
                        </div>
                        
                        <div
                            class="flex items-center justify-between border-t border-gray-700 bg-gray-900/50 p-4 text-sm text-gray-400"
                        >
                            <div class="flex items-center gap-2">
                                <img
                                    src={achievement.playerAvatar}
                                    alt="Player avatar"
                                    width="24"
                                    height="24"
                                    class="rounded-full"
                                />
                                <span>{achievement.player}</span>
                            </div>
                            <button class="h-8 w-8 p-0">
                                <ExternalLink class="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                {/each}
            </div> -->
        </div>
    </section>

    <!-- Features Section -->
    <section class="bg-gray-900/30 py-16">
        <div class="container mx-auto px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">
                Why Use Steam Vault?
            </h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each textCards as card}
                    <div
                        class="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center"
                    >
                        <div
                            class="mb-4 inline-flex items-center justify-center rounded-full bg-amber-500/10 p-3"
                        >
                            <card.icon class="h-6 w-6 text-amber-500" />
                        </div>
                        <h3 class="mb-2 text-xl font-bold">{card.title}</h3>
                        <p class="text-gray-400">{card.description}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20">
        <div class="container mx-auto px-4">
            <div
                class="rounded-xl border border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900 p-8 text-center md:p-12"
            >
                <h2 class="mb-4 text-3xl font-bold md:text-4xl">
                    Ready to Showcase Your Achievements?
                </h2>
                <p class="mx-auto mb-8 max-w-2xl text-gray-300">
                    It's free, just sign in with your Steam account and start
                    tracking your achievements.
                </p>
                <div class="flex justify-center">
                    {@render buttons()}
                </div>
            </div>
        </div>
    </section>
</main>

{#snippet buttons()}
    <div class="flex flex-wrap gap-4">
        {#if !data.loggedIn}
            <form action="?/login" method="POST">
                <button
                    class="btn preset-filled-primary-500 flex items-center gap-2 rounded p-3"
                >
                    Sign In Now
                    <ChevronRight class="ml-2 h-4 w-4" />
                </button>
            </form>
        {:else}
            <a
                href="/user/{data.loggedIn.id}"
                class="btn preset-filled-primary-500 flex items-center gap-2 rounded p-3"
            >
                Go to Dashboard
                <ChevronRight class="ml-2 h-4 w-4" />
            </a>
        {/if}

        <a href="/about" class="btn preset-outlined-surface-500">
            Learn More
        </a>
    </div>
{/snippet}
