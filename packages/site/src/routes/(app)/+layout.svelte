<script lang="ts">
    import { setSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import Footer from "./Footer.svelte";
    import Navbar from "./Navbar.svelte";
    const { children, data } = $props();

    // Initialize the universal sort manager
    setSortManager();
</script>

<svelte:head>
    <title>Steam Achievements</title>
    <meta name="description" content="View your Steam achievements." />
    <meta name="keywords" content="Steam, achievements, user" />
    <meta property="og:title" content="Steam Vault" />
    <meta property="og:description" content="View your Steam achievements." />
    <meta property="og:image" content="/card.png" />
    <meta property="og:type" content="summary_large_image" />
    <meta property="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="flex min-h-screen flex-col">
    <Navbar user={data.loggedIn} />

    <div class="grow">
        {@render children()}
    </div>

    <Footer />
</div>
