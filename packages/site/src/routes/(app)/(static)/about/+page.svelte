<script lang="ts">
    import ArrowRight from "@lucide/svelte/icons/arrow-right";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Github from "@lucide/svelte/icons/github";
    import Mail from "@lucide/svelte/icons/mail";
    import Trophy from "@lucide/svelte/icons/trophy";
    import DollarSign from "@lucide/svelte/icons/dollar-sign";
    import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
    import { Accordion } from "@skeletonlabs/skeleton-svelte";

    let team = [
        {
            name: "Cole Crouter",
            avatar: "https://avatars.githubusercontent.com/u/15883173?v=4",
            role: "Founder & Lead Developer",
        },
    ];

    let faqs = [
        {
            question: "What is Steam Vault?",
            answer: "Steam Vault is a platform that lets you view all of your achievements across Steam. We help you find your rarest achievements.",
        },
        {
            question: "Why is Steam Vault special?",
            answer: "Due to Steam's strict API guidelines, it is difficult to track achievement progress for many users, across thousands of games. Steam Vault aims to bridge that gap, while gathering as much data & insight as possible, and providing it to you (for free).",
        },
        {
            question: "How do I connect my Steam account?",
            answer: "Simply press the sign in button on the top right corner of the page. Connect your Steam account to start tracking your achievements.",
        },
        {
            question: "Is Steam Vault free to use?",
            answer: "Steam Vault is completely free to use. There are no paid features. We are funded entirely by advertising and donations.",
        },
        {
            question: "How often is achievement data updated?",
            answer: "Our data is updated systematically to maintain within Steam's API guidelines. If you feel like your data is not refreshing regularly, please reach out to us.",
        },
        {
            question: "Can I share my achievement profile with others?",
            answer: "Each user has a public profile page that can be shared via a unique URL. You can also generate shareable cards for individual achievements to post on social media.",
        },
        {
            question: "How is achievement rarity calculated?",
            answer: 'Achievement rarity is calculated based on a few factors. The "percentage" stat is from Steam directly, and it is unknown how that number is calculated. Our "score" represents how many people have unlocked the achievement. It is calculated using a rough estimate of how many people have played the game. We are always looking for new ways to analyze and visualize your achievements.',
        },
    ] satisfies Record<"question" | "answer", string>[];

    let { data } = $props();

    let features = [
        {
            title: "Achievement Tracking",
            shortDescription:
                "Automatically sync and update achievements across Steam.",
            description:
                "Our platform periodically refreshes your achievement data, ensuring you always have the latest information.",
            icon: Trophy,
            iconType: "component",
        },
        {
            title: "Rarity Analysis",
            shortDescription:
                "Discover your rarest and most impressive gaming achievements.",
            description:
                "We are always looking for new ways to analyze and visualize your achievements. Our rarity analysis feature helps you identify which achievements are the most difficult to unlock.",
            icon: DollarSign,
            iconType: "component",
        },
        {
            title: "Social Features",
            shortDescription:
                "Connect with friends and compare your achievement progress.",
            description:
                "Automatically find achievements from your friends and compare your progress. Share your achievements on social media and show off your gaming prowess.",
            icon: SlidersHorizontal,
            iconType: "component",
        },
    ];
</script>

<svelte:head>
    <title>Steam Vault — About</title>
    <meta
        name="description"
        content="Learn more about Steam Vault, our goal, and how we help gamers track their achievements."
    />
    <link rel="canonical" href="/about" />
    <meta property="og:title" content="About Steam Vault" />
    <meta
        property="og:description"
        content="Learn more about Steam Vault, our goal, and how we help gamers track their achievements."
    />
</svelte:head>

<div
    class="from-surface-900 to-surface-950 text-surface-100 min-h-screen bg-gradient-to-b"
>
    <main class="container mx-auto px-4 py-12">
        <!-- Hero Section -->
        <section class="mb-16 text-center">
            <div class="relative mb-6 inline-block">
                <!-- Icon thing -->
                <div
                    class="bg-primary-500/20 absolute inset-0 rounded-full blur-xl"
                ></div>
                <Trophy class="text-primary-500 relative h-20 w-20" />
            </div>
            <h1 class="mb-4 text-4xl font-bold md:text-5xl">
                About Steam Vault
            </h1>
            <p class="text-surface-300 mx-auto max-w-3xl text-xl">
                Tracking, showcasing, and celebrating your gaming achievements.
            </p>
        </section>

        <!-- Our Mission -->
        <section class="mb-16 flex flex-col items-center">
            <div class="grid max-w-2xl items-center gap-12">
                <div>
                    <h2 class="mb-6 text-center text-3xl font-bold">
                        Our Mission
                    </h2>
                    <p class="text-surface-300 mb-4">
                        Steam Vault was created with a simple goal: let gamers
                        find their rarest achievements across the platform.
                    </p>
                    <p class="text-surface-300 mb-4">
                        Achievements aren't always just milestones; they can
                        represent hours of dedication, learning, practicing, and
                        grinding. For most people, no one else will ever notice
                        this. Steam Vault aims to change that.
                    </p>
                    <p class="text-surface-300">
                        Our platform is designed to celebrate your gaming
                        journey, allowing you to view your achievements in a new
                        light. We also aim to provide you with insights and
                        other info to keep you going.
                    </p>
                </div>
            </div>
        </section>

        <!-- UPDATED: Key Features -->
        <section class="mb-16">
            <h2 class="mb-8 text-center text-3xl font-bold">Key Features</h2>
            <div class="grid gap-6 md:grid-cols-3">
                {#each features as feature}
                    <div class="card p-4">
                        <div class="flex flex-col items-center">
                            <div
                                class="bg-primary-500/10 mb-4 flex h-12 w-12 items-center justify-center rounded"
                            >
                                {#if feature.iconType === "component"}
                                    <feature.icon
                                        class="text-primary-500 h-6 w-6"
                                    />
                                {:else}
                                    {@html feature.icon}
                                {/if}
                            </div>
                            <h3 class="mb-2 font-bold">{feature.title}</h3>
                            <p
                                class="text-surface-300 mb-4 text-center text-sm"
                            >
                                {feature.shortDescription}
                            </p>
                        </div>
                        <p class="text-surface-300 text-sm">
                            {feature.description}
                        </p>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Team -->
        <section class="mb-16">
            <h2 class="mb-8 text-center text-3xl font-bold">Our Team</h2>
            <div class="flex flex-wrap justify-center gap-8">
                {#each team as member}
                    <div class="text-center">
                        <div
                            class="border-surface-700 bg-surface-800 mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border"
                        >
                            <img
                                src={member.avatar}
                                alt={member.name}
                                width="96"
                                height="96"
                            />
                        </div>
                        <h3 class="font-bold">{member.name}</h3>
                        <p class="text-surface-300 text-sm">{member.role}</p>
                    </div>
                {/each}
            </div>
        </section>

        <!-- FAQ -->
        <section class="mx-auto mb-16 max-w-[800px]">
            <h2 class="mb-8 text-center text-3xl font-bold">
                Frequently Asked Questions
            </h2>
            <Accordion multiple>
                {#each faqs as faq, index}
                    <Accordion.Item value={index.toString()}>
                        {#snippet control()}{faq.question}{/snippet}
                        {#snippet panel()}
                            <p class="p-4">
                                {faq.answer}
                            </p>
                        {/snippet}
                    </Accordion.Item>
                    {#if index < faqs.length - 1}
                        <hr class="hr" />
                    {/if}
                {/each}
            </Accordion>
        </section>

        <!-- Contact -->
        <section class="mb-16">
            <div class="card mx-auto max-w-3xl p-8">
                <h2 class="mb-6 text-center text-3xl font-bold">
                    Get In Touch
                </h2>
                <p class="text-surface-300 mb-8 text-center">
                    Have questions, feedback, or just want to say hello? We'd
                    love to hear from you!
                </p>
                <div class="grid gap-8 md:grid-cols-2">
                    <div>
                        <div class="mb-6 flex items-center gap-4">
                            <div
                                class="bg-primary-500/10 flex h-10 w-10 items-center justify-center rounded-full"
                            >
                                <Mail class="text-primary-500 h-5 w-5" />
                            </div>
                            <div>
                                <h3 class="font-medium">Email Us</h3>
                                <a
                                    class="text-surface-300 text-sm hover:underline"
                                    href="mailto:support@steamvault.info"
                                >
                                    support@steamvault.info
                                </a>
                            </div>
                        </div>
                        <!-- <div class="mb-6 flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10"
                            >
                                <Twitter class="h-5 w-5 text-primary-500" />
                            </div>
                            <div>
                                <h3 class="font-medium">Twitter</h3>
                                <p class="text-sm text-surface-300">
                                    @AchievementVault
                                </p>
                            </div>
                        </div> -->
                        <div class="flex items-center gap-4">
                            <div
                                class="bg-primary-500/10 flex h-10 w-10 items-center justify-center rounded-full"
                            >
                                <Github class="text-primary-500 h-5 w-5" />
                            </div>
                            <div>
                                <h3 class="font-medium">GitHub</h3>
                                <a
                                    class="text-surface-300 text-sm hover:underline"
                                    href="https://github.com/colecrouter/rarest-achievement"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    github.com/colecrouter/rarest-achievement
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center">
                        <p class="text-surface-300/20 mb-4">
                            Follow us on social media for updates, tips, and to
                            join our growing community of achievement hunters.
                        </p>
                        <button
                            disabled
                            class="btn preset-filled-primary-500 flex w-full items-center justify-center py-2"
                        >
                            Join Our Discord
                            <ArrowRight class="ml-2 h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- CTA -->
        <section>
            <div class="text-center">
                <h2 class="mb-4 text-3xl font-bold">
                    Ready to Showcase Your Achievements?
                </h2>
                <p class="text-surface-300 mx-auto mb-8 max-w-2xl">
                    Join thousands of gamers who are tracking and sharing their
                    gaming accomplishments with Steam Vault.
                </p>

                <div class="flex flex-wrap justify-center gap-4">
                    {#if !data.loggedIn}
                        <form action="?/login" method="POST">
                            <button class="btn preset-filled-primary-500 p-3">
                                Sign In Now
                                <ChevronRight class="ml-2 h-4 w-4" />
                            </button>
                        </form>
                    {:else}
                        <a
                            href="/user/{data.loggedIn.id}"
                            class="btn preset-filled-primary-500 p-3"
                        >
                            Go to Dashboard
                            <ChevronRight class="ml-2 h-4 w-4" />
                        </a>
                    {/if}
                </div>
            </div>
        </section>
    </main>
</div>
