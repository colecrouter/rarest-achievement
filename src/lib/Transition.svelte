<script lang="ts">
    import { fade } from "svelte/transition";

    const { children } = $props();
</script>

<div
    in:fade|local={{ duration: 200, delay: 200 }}
    out:fade|local={{ duration: 200 }}
    class="ol-span-full col-span-full row-span-full"
>
    {@render children()}
</div>
