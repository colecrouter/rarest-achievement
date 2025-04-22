<script lang="ts">
    import { type SortMethod, getSortManager } from "$lib/sortManager.svelte";
    import { Segment } from "@skeletonlabs/skeleton-svelte";

    const sortManager = getSortManager();

    let align = $state("left");
</script>

<!-- <nav class="btn-group preset-outlined-surface-200-800 flex-col md:flex-row">
    <button
        onclick={() => (sortManager.method = "globalPercentage")}
        class="btn btn-sm {sortManager.method === 'globalPercentage'
            ? 'preset-filled'
            : 'hover:preset-tonal'}">Player %</button
    >
    <button
        onclick={() => (sortManager.method = "globalCount")}
        class="btn btn-sm {sortManager.method === 'globalCount'
            ? 'preset-filled'
            : 'hover:preset-tonal'}">Player Count</button
    >
</nav> -->

<Segment
    value={sortManager.method}
    onValueChange={(e) => (sortManager.method = e.value as SortMethod)}
>
    <Segment.Item labelClasses="text-sm" value="globalPercentage"
        >Player %</Segment.Item
    >
    <Segment.Item labelClasses="text-sm" value="globalCount"
        >Player Count</Segment.Item
    >
</Segment>
