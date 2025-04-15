<script lang="ts">
    import IndexError from "$lib/IndexError.svelte";
    import Transition from "$lib/Transition.svelte";
    import Splash from "$lib/loading/Splash.svelte";
    import Breadcrumbs from "../../Breadcrumbs.svelte";
    import Achievements from "./Achievements.svelte";

    let { data } = $props();
</script>

<svelte:head>
    <title>{data.user.displayName} - Achievements</title>
    <meta name="description" content="View your Steam achievements." />
    <meta name="keywords" content="Steam, achievements, user" />
    <meta name="author" content="Your Name" />
    <meta
        property="og:title"
        content="{data.user.displayName} - Achievements"
    />
    <meta property="og:description" content="View your Steam achievements." />
    <meta property="og:image" content={data.user.avatar} />
    <meta property="og:url" content={data.user.profileUrl} />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
</svelte:head>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    <Breadcrumbs path={data.breadcrumbs} />

    {#await data.achievements}
        <Transition>
            <Splash message={data.message} />
        </Transition>
    {:then { achievements, didErr }}
        <Transition>
            {#if didErr}
                <IndexError />
            {/if}

            <Achievements {achievements} />
        </Transition>
    {/await}
</main>
