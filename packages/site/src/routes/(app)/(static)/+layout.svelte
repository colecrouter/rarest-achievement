<script lang="ts">
    let { children } = $props();
</script>

<svelte:head>
    <meta name="keywords" content="Steam, achievements, user" />
    <meta property="og:image" content="/card.png" />
    <meta property="og:type" content="summary_large_image" />
    <meta property="twitter:card" content="summary_large_image" />
</svelte:head>

{@render children()}
