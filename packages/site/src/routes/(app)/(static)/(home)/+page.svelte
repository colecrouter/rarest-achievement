<script lang="ts">
    import AchievementCards from "$lib/AchievementCards";
    import Award from "@lucide/svelte/icons/award";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Crown from "@lucide/svelte/icons/crown";
    import Search from "@lucide/svelte/icons/search";
    import TrendingUp from "@lucide/svelte/icons/trending-up";
    import Trophy from "@lucide/svelte/icons/trophy";
    import Users from "@lucide/svelte/icons/users";
    import NumberFlow from "@number-flow/svelte";
    import { fly } from "svelte/transition";

    let { data } = $props();

    // Stats for the home page
    const stats = [
        {
            label: "Tracked Achievements",
            value: data.stats.achievementCount,
            icon: Trophy,
        },
        {
            label: "Indexed Users",
            value: data.stats.userCount,
            icon: Users,
        },
        {
            label: "Indexed Games",
            value: data.stats.gameCount,
            icon: TrendingUp,
        },
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

    const rotations = ["rotate-1", "-rotate-1", "rotate-1"];

    let animate = $state(false);
    $effect(() => {
        animate = true;
    });
</script>

<svelte:head>
    <title>Steam Vault - Showcase Your Achievements</title>
    <meta
        name="description"
        content="Track and share your most impressive gaming accomplishments. See how you stack up against other players with Steam Vault."
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
    <section class="hero relative overflow-hidden">
        <div
            class="from-surface-950/0 to-surface-950/50 bg-gradient-to-l py-20"
        >
            <div class="container">
                <div class="grid items-center gap-8 md:grid-cols-2">
                    <div class="space-y-6">
                        <h1
                            class="text-4xl leading-tight font-bold md:text-5xl lg:text-6xl"
                        >
                            Showcase Your Rarest Achievements on Steam
                        </h1>
                        <p class="max-w-lg text-lg">
                            Track and share your most impressive gaming
                            accomplishments. See how you stack up against other
                            players with Steam Vault.
                        </p>
                        {@render buttons()}
                    </div>
                    <div class="relative">
                        <div class="card border p-6 shadow-xl">
                            <div class="absolute -top-6 -right-2 md:-right-6">
                                <div class="relative">
                                    <div
                                        class="bg-primary-500/20 absolute inset-0 animate-pulse rounded-full"
                                    ></div>
                                    <Crown
                                        class="text-primary-500 relative z-10 h-16 w-16 p-2"
                                    />
                                </div>
                            </div>
                            <div class="mb-6 flex items-center gap-4">
                                <Trophy class="text-primary-500 h-8 w-8" />
                                <h3 class="text-xl font-bold">
                                    Top Achievement Hunters
                                </h3>
                            </div>
                            <div class="space-y-4">
                                {#each [1, 2, 3] as rank}
                                    <div
                                        class="card secondary flex items-center gap-3 p-3"
                                    >
                                        <div
                                            class="bg-surface-800 text-primary-500 flex h-8 w-8 items-center justify-center rounded-full font-bold"
                                        >
                                            {rank}
                                        </div>
                                        <img
                                            src="/placeholder.svg"
                                            alt="User avatar"
                                            width="40"
                                            height="40"
                                            class="border-surface-700 rounded-full border"
                                        />
                                        <div>
                                            <div class="font-medium">
                                                Player{rank}
                                            </div>
                                            <div
                                                class="text-surface-300 text-xs"
                                            >
                                                {Math.floor(
                                                    Math.random() * 500,
                                                ) + 500} rare achievements
                                            </div>
                                        </div>
                                        <div class="ml-auto">
                                            <!-- <button class="h-8 w-8 p-0">
                                            <ChevronRight class="h-4 w-4" />
                                        </button> -->
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Example achievements -->
    <section class="py-16">
        <div
            class="container mx-auto min-h-[430px] md:flex md:flex-row-reverse"
        >
            <div class="p-4 text-center md:flex md:flex-col md:justify-center">
                <h2 class="mb-8 text-3xl font-bold">
                    Explore Your Achievements
                </h2>
                <p>
                    Find achievements for <i>every</i> game in your library. No challenge
                    is too great!
                </p>
            </div>
            <div class="grid grid-cols-1 gap-6 pt-4 transition-all">
                {#each data.showcase2 as achievement, i}
                    {#if animate}
                        <div
                            transition:fly={{
                                y: 20,
                                duration: 300,
                                delay: i * 100,
                            }}
                            class="shadow-primary-500/30 even:shadow-lg {rotations[
                                i % rotations.length
                            ]}"
                        >
                            <AchievementCards.Card {achievement} />
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section class="bg-surface-900/30 py-16">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each stats as stat}
                    <div class="flex flex-col items-center text-center">
                        <div class="bg-primary-500/10 mb-4 rounded-full p-4">
                            <stat.icon class="text-primary-500 h-8 w-8" />
                        </div>
                        <div class="mb-2 text-4xl font-bold">
                            <NumberFlow
                                value={animate ? stat.value : 0}
                                format={{
                                    style: "decimal",
                                    notation: "compact",
                                    roundingMode: "halfExpand",
                                    maximumSignificantDigits: 2,
                                }}
                                trend={0}
                                suffix="+"
                            />
                        </div>
                        <div class="text-surface-300">{stat.label}</div>
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
                    <p class="text-surface-300 max-w-2xl">
                        Check out some of the rarest achievements unlocked by
                        our community members.
                    </p>
                </div>
                <button
                    class="btn preset-outlined-surface-500 relative mt-4 flex items-center gap-2 rounded"
                    disabled
                >
                    View All
                    <ChevronRight class="ml-2 h-4 w-4" />
                    <span
                        class="badge preset-filled-primary-500 absolute -top-4 -right-4"
                    >
                        Coming Soon
                    </span>
                </button>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                {#each data.featuredAchievements as achievement}
                    <AchievementCards.Card {achievement} />
                {/each}
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="bg-surface-900/30 py-16">
        <div class="container mx-auto px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">
                Why Use Steam Vault?
            </h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each textCards as card}
                    <div class="card p-6 text-center">
                        <div
                            class="bg-primary-500/10 mb-4 inline-flex items-center justify-center rounded-full p-3"
                        >
                            <card.icon class="text-primary-500 h-6 w-6" />
                        </div>
                        <h3 class="mb-2 text-xl font-bold">{card.title}</h3>
                        <p class="text-surface-300">{card.description}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20">
        <div class="container mx-auto px-4">
            <div
                class="border-surface-700 from-surface-800 to-surface-900 card bg-gradient-to-r p-8 text-center md:p-12"
            >
                <h2 class="mb-4 text-3xl font-bold md:text-4xl">
                    Ready to Showcase Your Achievements?
                </h2>
                <p class="text-surface-300 mx-auto mb-8 max-w-2xl">
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

<style>
    @import "./hero.css";
</style>
