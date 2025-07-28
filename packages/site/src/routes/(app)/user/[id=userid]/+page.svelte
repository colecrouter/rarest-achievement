<script lang="ts">
    import IndexError from "$lib/IndexError.svelte";
    import Transition from "$lib/Transition.svelte";
    import Splash from "$lib/loading/Splash.svelte";
    import { m } from "$lib/paraglide/messages.js";
    import Breadcrumbs from "../../Breadcrumbs.svelte";
    import type { PageData } from "./$types.js";
    import Achievements from "./Achievements.svelte";

    let { data }: { data: PageData } = $props();

    // Get the type of the resolved topThree data
    type TopThreeData = Awaited<typeof data.topThree>;

    // Track if we've loaded topThree once to avoid re-showing splash
    let hasLoadedOnce = $state(false);
    let cachedTopThree = $state<TopThreeData | null>(null);

    // Use an effect to handle caching when the promise resolves
    $effect(() => {
        if (data.topThree && typeof data.topThree.then === "function") {
            data.topThree.then((resolved: TopThreeData) => {
                if (!hasLoadedOnce) {
                    hasLoadedOnce = true;
                    cachedTopThree = resolved;
                }
            });
        }
    });
</script>

<svelte:head>
    <title>{m.userPageMetaTitle({ displayName: data.user.displayName })}</title>
    <meta name="description" content={m.userPageMetaDescription()} />
    <meta
        name="keywords"
        content={m.userPageMetaKeywords({
            userId: data.user.id,
            displayName: data.user.displayName,
        })}
    />
    <meta
        property="og:title"
        content={m.userPageMetaTitle({ displayName: data.user.displayName })}
    />
    <meta property="og:description" content={m.userPageMetaDescription()} />
    <meta property="og:image" content={data.user.avatar} />
    <meta property="og:url" content={data.user.profileUrl} />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
</svelte:head>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    <Breadcrumbs path={data.breadcrumbs} />

    {#if hasLoadedOnce && cachedTopThree}
        <!-- Use cached data to avoid remounting -->
        <Transition>
            {#if cachedTopThree.isError()}
                <IndexError />
            {/if}
            <Achievements
                topThree={cachedTopThree.data}
                user={data.user}
                achievements={data.achievements}
            />
        </Transition>
    {:else}
        <!-- Show loading state and await first time -->
        {#await data.topThree}
            <Transition>
                <Splash message={data.message} />
            </Transition>
        {:then topThree}
            <Transition>
                {#if topThree.isError()}
                    <IndexError />
                {/if}
                <Achievements
                    topThree={topThree.data}
                    user={data.user}
                    achievements={data.achievements}
                />
            </Transition>
        {/await}
    {/if}
</main>
