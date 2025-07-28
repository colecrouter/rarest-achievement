<script lang="ts">
    import { page } from "$app/state";
    import { setAchievementServerSortManager } from "$lib/SortManager/AchievementSortManager";

    let { children } = $props();

    let url = $derived(page.url);

    setAchievementServerSortManager();
</script>

{@render children()}
