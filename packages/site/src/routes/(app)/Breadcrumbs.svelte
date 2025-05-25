<script lang="ts">
    import { page } from "$app/stores";
    import type { Breadcrumb } from "$lib/breadcrumbs";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import House from "@lucide/svelte/icons/house";
    import { localizeHref } from "$lib/paraglide/runtime";

    interface Props {
        path: Breadcrumb[];
    }

    let { path }: Props = $props();
</script>

<svelte:head>
    <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": path.map((b, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name":
          typeof b.label === "string"
            ? b.label
            : /* if label is a component, you might supply a `.text` field on your Breadcrumb type */ "",
        "item": new URL(b.href ?? page.url.pathname, page.url.origin).href
      }))
    })}
    </script>
</svelte:head>

<ol class="mb-8 flex items-center gap-4">
    <li>
        <a class="opacity-60 hover:opacity-100" href={localizeHref("/")}>
            <House size={24} />
        </a>
    </li>
    {#each path as breadcrumb, i}
        <li class="opacity-50" aria-hidden="true">
            <ChevronRight size={14} />
        </li>
        <li>
            {#snippet content(b: Breadcrumb)}
                {#if typeof b.label === "string"}
                    {b.label}
                {:else}
                    <b.label size={24} />
                {/if}
            {/snippet}

            {#if breadcrumb.href && i !== path.length - 1}
                <a
                    class="opacity-60 hover:opacity-100"
                    href={localizeHref(breadcrumb.href)}
                >
                    {@render content(breadcrumb)}
                </a>
            {:else}
                <span>
                    {@render content(breadcrumb)}
                </span>
            {/if}
        </li>
    {/each}
</ol>
