<script lang="ts">
    import { fade } from "svelte/transition";

    const { children } = $props();
</script>

<div
    in:fade|local={{ duration: 100, delay: 100 }}
    out:fade|local={{ duration: 100 }}
    class="ol-span-full col-span-full row-span-full"
>
    {@render children()}
</div>
