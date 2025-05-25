<script lang="ts">
    import { page } from "$app/state";
    import { locales, localizeHref } from "$lib/paraglide/runtime";
    import "../app.css";
    const { children } = $props();
</script>

<div style="display: none">
    {#each locales as locale}
        <a rel="alternate" href={localizeHref(page.url.pathname, { locale })}>
            {locale}
        </a>
    {/each}
</div>

{@render children()}
