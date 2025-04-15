<script lang="ts">
    import { getSortManager } from "$lib/sortManager.svelte";

    const sortManager = getSortManager();
</script>

<nav class="btn-group preset-outlined-surface-200-800 flex-col md:flex-row">
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
</nav>
