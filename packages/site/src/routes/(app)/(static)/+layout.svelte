<script lang="ts">
    import { m } from "$lib/paraglide/messages";

    let { children } = $props();
</script>

<svelte:head>
    <meta property="og:image" content="/card.png" />
    <meta property="og:type" content="summary_large_image" />
    <meta property="twitter:card" content="summary_large_image" />
</svelte:head>

{@render children()}
