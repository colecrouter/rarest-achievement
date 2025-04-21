<script lang="ts">
    import ArrowRight from "@lucide/svelte/icons/arrow-right";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Github from "@lucide/svelte/icons/github";
    import Mail from "@lucide/svelte/icons/mail";
    import Trophy from "@lucide/svelte/icons/trophy";
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
</script>

<svelte:head>
    <title>About Steam Vault</title>
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
    class="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-gray-100"
>
    <main class="container mx-auto px-4 py-12">
        <!-- Hero Section -->
        <section class="mb-16 text-center">
            <div class="relative mb-6 inline-block">
                <div
                    class="absolute inset-0 rounded-full bg-amber-500/20 blur-xl"
                ></div>
                <Trophy class="relative h-20 w-20 text-amber-500" />
            </div>
            <h1 class="mb-4 text-4xl font-bold md:text-5xl">
                About Steam Vault
            </h1>
            <p class="mx-auto max-w-3xl text-xl text-gray-300">
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
                    <p class="mb-4 text-gray-300">
                        Steam Vault was created with a simple goal: let gamers
                        find their rarest achievements across the platform.
                    </p>
                    <p class="mb-4 text-gray-300">
                        Achievements aren't always just milestones; they can
                        represent hours of dedication, learning, practicing, and
                        grinding. For most people, no one else will ever notice
                        this. Steam Vault aims to change that.
                    </p>
                    <p class="text-gray-300">
                        Our platform is designed to celebrate your gaming
                        journey, allowing you to view your achievements in a new
                        light. We also aim to provide you with insights and
                        other info to keep you going.
                    </p>
                </div>
            </div>
        </section>

        <!-- Key Features -->
        <section class="mb-16">
            <h2 class="mb-8 text-center text-3xl font-bold">Key Features</h2>
            <div class="grid gap-6 md:grid-cols-3">
                <!-- Feature 1 -->
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-6">
                    <div class="flex flex-col items-center">
                        <div
                            class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10"
                        >
                            <Trophy class="h-6 w-6 text-amber-500" />
                        </div>
                        <h3 class="mb-2 font-bold">Achievement Tracking</h3>
                        <p class="mb-4 text-center text-sm text-gray-300">
                            Automatically sync and update achievements across
                            Steam.
                        </p>
                    </div>
                    <p class="text-sm text-gray-300">
                        Our platform periodically refreshes your achievement
                        data, ensuring you always have the latest information.
                    </p>
                </div>
                <!-- Feature 2 -->
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-6">
                    <div class="flex flex-col items-center">
                        <div
                            class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6 text-amber-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                                />
                            </svg>
                        </div>
                        <h3 class="mb-2 font-bold">Rarity Analysis</h3>
                        <p class="mb-4 text-center text-sm text-gray-300">
                            Discover your rarest and most impressive gaming
                            achievements.
                        </p>
                    </div>
                    <p class="text-sm text-gray-300">
                        We are always looking for new ways to analyze and
                        visualize your achievements. Our rarity analysis feature
                        helps you identify which achievements are the most
                        difficult to unlock.
                    </p>
                </div>
                <!-- Feature 3 -->
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-6">
                    <div class="flex flex-col items-center">
                        <div
                            class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6 text-amber-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M17 6.1H3M21 12.1H3M21 18.1H3M16 6c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2ZM10 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2ZM10 18c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2Z"
                                />
                            </svg>
                        </div>
                        <h3 class="mb-2 font-bold">Social Features</h3>
                        <p class="mb-4 text-center text-sm text-gray-300">
                            Connect with friends and compare your achievement
                            progress.
                        </p>
                    </div>
                    <p class="text-sm text-gray-300">
                        Automatically find achievements from your friends and
                        compare your progress. Share your achievements on social
                        media and show off your gaming prowess.
                    </p>
                </div>
            </div>
        </section>

        <!-- Team -->
        <section class="mb-16">
            <h2 class="mb-8 text-center text-3xl font-bold">Our Team</h2>
            <div class="flex flex-wrap justify-center gap-8">
                {#each team as member}
                    <div class="text-center">
                        <div
                            class="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border border-gray-700 bg-gray-800"
                        >
                            <img
                                src={member.avatar}
                                alt={member.name}
                                width="96"
                                height="96"
                            />
                        </div>
                        <h3 class="font-bold">{member.name}</h3>
                        <p class="text-sm text-gray-400">{member.role}</p>
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
                            <p
                                class="bg-surface-950 -mx-4 rounded-lg p-4 text-gray-300"
                            >
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
            <div
                class="mx-auto max-w-3xl rounded-xl border border-gray-700 bg-gray-800 p-8"
            >
                <h2 class="mb-6 text-center text-3xl font-bold">
                    Get In Touch
                </h2>
                <p class="mb-8 text-center text-gray-300">
                    Have questions, feedback, or just want to say hello? We'd
                    love to hear from you!
                </p>
                <div class="grid gap-8 md:grid-cols-2">
                    <div>
                        <div class="mb-6 flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10"
                            >
                                <Mail class="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 class="font-medium">Email Us</h3>
                                <p class="text-sm text-gray-400">
                                    support@todo.com
                                </p>
                            </div>
                        </div>
                        <!-- <div class="mb-6 flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10"
                            >
                                <Twitter class="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 class="font-medium">Twitter</h3>
                                <p class="text-sm text-gray-400">
                                    @AchievementVault
                                </p>
                            </div>
                        </div> -->
                        <div class="flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10"
                            >
                                <Github class="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 class="font-medium">GitHub</h3>
                                <p class="text-sm text-gray-400">
                                    github.com/todo
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center">
                        <p class="mb-4 text-gray-300/20">
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
                <p class="mx-auto mb-8 max-w-2xl text-gray-300">
                    Join thousands of gamers who are tracking and sharing their
                    gaming accomplishments with Steam Vault.
                </p>

                <div class="flex flex-wrap justify-center gap-4">
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
                </div>
            </div>
        </section>
    </main>
</div>
