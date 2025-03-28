<script lang="ts">
    // Import icons from lucide-svelte
    import {
        Award,
        ChevronRight,
        Crown,
        ExternalLink,
        Search,
        Trophy,
        TrendingUp,
        User,
        Users,
    } from "lucide-svelte";

    // Featured achievements for the home page
    const featuredAchievements = [
        {
            id: 1,
            name: "Against All Odds",
            description:
                "Complete the final mission on Insane difficulty without any squad member dying",
            game: "Mass Effect 2",
            rarity: 0.8,
            icon: "/placeholder.svg?height=64&width=64",
            player: "SteamUser123",
            playerAvatar: "/placeholder.svg?height=32&width=32",
        },
        {
            id: 2,
            name: "Platinum God",
            description: "Collect all items and complete all challenges",
            game: "The Binding of Isaac: Rebirth",
            rarity: 1.2,
            icon: "/placeholder.svg?height=64&width=64",
            player: "GamerPro99",
            playerAvatar: "/placeholder.svg?height=32&width=32",
        },
        {
            id: 3,
            name: "Mile High Club",
            description: "Complete the epilogue mission on Veteran difficulty",
            game: "Call of Duty 4: Modern Warfare",
            rarity: 1.7,
            icon: "/placeholder.svg?height=64&width=64",
            player: "FPSMaster",
            playerAvatar: "/placeholder.svg?height=32&width=32",
        },
    ];

    // Stats for the home page
    const stats = [
        { label: "Tracked Achievements", value: "1.2M+", icon: Trophy },
        { label: "Active Users", value: "250K+", icon: Users },
        { label: "Games Supported", value: "12,000+", icon: TrendingUp },
    ];
</script>

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
                        Showcase Your Rarest Gaming Achievements
                    </h1>
                    <p class="max-w-lg text-lg text-gray-300">
                        Track, display, and share your most impressive gaming
                        accomplishments. See how you stack up against other
                        players with Achievement Vault.
                    </p>
                    <div class="flex flex-wrap gap-4">
                        <a href="/dashboard" class="inline-block">
                            <button
                                class="btn preset-filled-primary-500 flex items-center gap-2 rounded p-3"
                            >
                                View Your Dashboard
                                <ChevronRight class="ml-2 h-4 w-4" />
                            </button>
                        </a>
                        <button
                            class="btn preset-outlined-surface-500 flex items-center gap-2 rounded p-3"
                        >
                            Learn More
                        </button>
                    </div>
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
                                    class="relative z-10 h-12 w-12 text-amber-500"
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

    <!-- Stats Section -->
    <section class="bg-gray-900/30 py-16">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each stats as stat}
                    <div class="flex flex-col items-center text-center">
                        <div class="mb-4 rounded-full bg-amber-500/10 p-4">
                            <svelte:component
                                this={stat.icon}
                                class="h-8 w-8 text-amber-500"
                            />
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

            <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                {#each featuredAchievements as achievement}
                    <div
                        class="overflow-hidden rounded border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
                    >
                        <!-- Card Header -->
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
                        <!-- Card Content -->
                        <div class="p-4">
                            <p class="text-sm text-gray-300">
                                {achievement.description}
                            </p>
                        </div>
                        <!-- Card Footer -->
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
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="bg-gray-900/30 py-16">
        <div class="container mx-auto px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">
                Why Use Achievement Vault?
            </h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div
                    class="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center"
                >
                    <div
                        class="mb-4 inline-flex items-center justify-center rounded-full bg-amber-500/10 p-3"
                    >
                        <Trophy class="h-6 w-6 text-amber-500" />
                    </div>
                    <h3 class="mb-2 text-xl font-bold">
                        Track Your Achievements
                    </h3>
                    <p class="text-gray-400">
                        Automatically sync and track all your gaming
                        achievements across multiple platforms in one place.
                    </p>
                </div>
                <div
                    class="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center"
                >
                    <div
                        class="mb-4 inline-flex items-center justify-center rounded-full bg-amber-500/10 p-3"
                    >
                        <Award class="h-6 w-6 text-amber-500" />
                    </div>
                    <h3 class="mb-2 text-xl font-bold">
                        Showcase Rare Accomplishments
                    </h3>
                    <p class="text-gray-400">
                        Display your rarest and most impressive achievements
                        with beautiful visualizations and statistics.
                    </p>
                </div>
                <div
                    class="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center"
                >
                    <div
                        class="mb-4 inline-flex items-center justify-center rounded-full bg-amber-500/10 p-3"
                    >
                        <Users class="h-6 w-6 text-amber-500" />
                    </div>
                    <h3 class="mb-2 text-xl font-bold">Connect With Gamers</h3>
                    <p class="text-gray-400">
                        Find and follow other achievement hunters, compare
                        stats, and build your gaming community.
                    </p>
                </div>
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
                    Join thousands of gamers who are tracking and sharing their
                    gaming accomplishments with Achievement Vault.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/dashboard" class="inline-block">
                        <button class="btn preset-filled-primary-500">
                            Get Started Now
                        </button>
                    </a>
                    <button class="btn preset-outlined-surface-500">
                        Learn More
                    </button>
                </div>
            </div>
        </div>
    </section>
</main>
