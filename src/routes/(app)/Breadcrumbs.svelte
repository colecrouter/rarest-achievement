<script lang="ts">
    import type { Breadcrumb } from "$lib/breadcrumbs";
    import { House } from "lucide-svelte";
    import { ChevronRight } from "lucide-svelte";

    interface Props {
        path: Breadcrumb[];
    }

    let { path }: Props = $props();
</script>

<ol class="mb-8 flex items-center gap-4">
    <li>
        <a class="opacity-60 hover:opacity-100" href="/">
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
                <a class="opacity-60 hover:opacity-100" href={breadcrumb.href}>
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
