<script lang="ts">
    import { page } from "$app/state";
    import AchievementCards from "$lib/AchievementCards";
    import { m } from "$lib/paraglide/messages.js";
    import {
        deLocalizeUrl,
        getLocale,
        localizeHref,
    } from "$lib/paraglide/runtime";
    import {
        AchievementClientSortManager,
        setAchievementClientSortManager,
    } from "$lib/SortManager/AchievementSortManager.js";
    import Award from "@lucide/svelte/icons/award";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Crown from "@lucide/svelte/icons/crown";
    import Search from "@lucide/svelte/icons/search";
    import TrendingUp from "@lucide/svelte/icons/trending-up";
    import Trophy from "@lucide/svelte/icons/trophy";
    import Users from "@lucide/svelte/icons/users";
    import NumberFlow from "@number-flow/svelte";
    import { fly } from "svelte/transition";
    import { Reveal, reveal } from "sveltersect";

    let { data } = $props();

    // Stats for the home page
    const stats = [
        {
            label: m.homepageStatsTrackedAchievements(),
            value: data.stats.achievementCount,
            icon: Trophy,
        },
        {
            label: m.homepageStatsIndexedUsers(),
            value: data.stats.userCount,
            icon: Users,
        },
        {
            label: m.homepageStatsIndexedGames(),
            value: data.stats.gameCount,
            icon: TrendingUp,
        },
    ];

    const textCards = [
        {
            title: m.homepageTextCard1Title(),
            description: m.homepageTextCard1Description(),
            icon: Award,
        },
        {
            title: m.homepageTextCard2Title(),
            description: m.homepageTextCard2Description(),
            icon: Search,
        },
        {
            title: m.homepageTextCard3Title(),
            description: m.homepageTextCard3Description(),
            icon: Users,
        },
    ] satisfies Array<{
        title: string;
        description: string;
        icon: typeof Trophy;
    }>;

    const rotations = ["rotate-1", "-rotate-1", "rotate-1"];

    let tracked = $state<[number, number, number]>([0, 0, 0]);

    const setTracked = () => {
        tracked = [
            data.stats.achievementCount,
            data.stats.userCount,
            data.stats.gameCount,
        ];
    };

    let exploreTarget = $state<HTMLElement | null>(null);

    $inspect(exploreTarget);

    setAchievementClientSortManager();
</script>

<svelte:head>
    <title>{m.homepageMetaTitle()}</title>
    <meta name="description" content={m.homepageMetaDescription()} />
    <meta name="keywords" content={m.layoutMetaKeywords()} />

    <meta property="og:title" content={m.homepageMetaTitle()} />
    <meta property="og:description" content={m.homepageMetaDescription()} />
    <link rel="canonical" href={deLocalizeUrl(page.url).toString()} />
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
                            {m.homepageHeroTitle()}
                        </h1>
                        <p class="max-w-lg text-lg">
                            {m.homepageHeroDescription()}
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
                                    {m.homepageTopAchievementHunters()}
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
                                                {m.homepageAchievementPlayer({
                                                    rank,
                                                })}
                                            </div>
                                            <div
                                                class="text-surface-300 text-xs"
                                            >
                                                {m.homepageRareAchievements({
                                                    count:
                                                        Math.floor(
                                                            Math.random() * 500,
                                                        ) + 500,
                                                })}
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
    <section class="p-8">
        <div class="container mx-auto md:flex md:flex-row-reverse">
            <div class="p-4 text-center md:flex md:flex-col md:justify-center">
                <h2 class="mb-8 text-3xl font-bold">
                    {m.homepageExploreTitle()}
                </h2>
                <p>
                    {m.homepageExploreDescription()}
                </p>
            </div>
            <div
                class="grid grid-cols-1 gap-6 pt-4 transition-all"
                bind:this={exploreTarget}
            >
                {#each data.showcase2 as achievement, i}
                    <Reveal
                        in={{
                            animation: fly,
                            params: {
                                y: 20,
                                duration: 300,
                                delay: i * 200,
                            },
                            threshold: 0.5,
                        }}
                        once
                        target={exploreTarget}
                    >
                        <div
                            class="shadow-primary-500/30 float even:shadow-lg {rotations[
                                i % rotations.length
                            ]}"
                        >
                            <AchievementCards.Card {achievement} />
                        </div>
                    </Reveal>
                {/each}
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section class="bg-surface-900/30 py-16">
        <div class="container mx-auto px-4">
            <div
                class="grid grid-cols-1 gap-8 md:grid-cols-3"
                use:reveal={{
                    callbacks: {
                        enter: setTracked,
                    },
                    transition: {
                        threshold: 0.5,
                    },
                    once: true,
                    initial: true,
                }}
            >
                {#each stats as stat, i}
                    {@const value = tracked[i]}
                    <div class="flex flex-col items-center text-center">
                        <div class="bg-primary-500/10 mb-4 rounded-full p-4">
                            <stat.icon class="text-primary-500 h-8 w-8" />
                        </div>
                        <div class="mb-2 text-4xl font-bold">
                            <NumberFlow
                                {value}
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
                        {m.homepageFeaturedTitle()}
                    </h2>
                    <p class="text-surface-300 max-w-2xl">
                        {m.homepageFeaturedDescription()}
                    </p>
                </div>
                <button
                    class="btn preset-outlined-surface-500 relative mt-4 flex items-center gap-2 rounded"
                    disabled
                >
                    {m.homepageViewAll()}
                    <ChevronRight class="ml-2 h-4 w-4" />
                    <span
                        class="badge preset-filled-primary-500 absolute -top-4 -right-4"
                    >
                        {m.homepageComingSoon()}
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
                {m.homepageFeaturesTitle()}
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
                    {m.ctaTitle()}
                </h2>
                <p class="text-surface-300 mx-auto mb-8 max-w-2xl">
                    {m.homepageCtaDescription()}
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
                    {m.homepageFeaturesSignIn()}
                    <ChevronRight class="ml-2 h-4 w-4" />
                </button>
            </form>
        {:else}
            <a
                href={localizeHref(`/user/${data.loggedIn.id}`)}
                class="btn preset-filled-primary-500 flex items-center gap-2 rounded p-3"
            >
                {m.homepageFeaturesDashboard()}
                <ChevronRight class="ml-2 h-4 w-4" />
            </a>
        {/if}

        <a
            href={localizeHref("/about")}
            class="btn preset-outlined-surface-500"
        >
            {m.homepageFeaturesLearnMore()}
        </a>
    </div>
{/snippet}

<style>
    @import "./hero.css";

    @keyframes float {
        0% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-5px);
        }
        100% {
            transform: translateY(0);
        }
    }

    .float {
        animation: float 3s ease-in-out infinite;
    }
</style>
