<script lang="ts">
	import { setAchievementClientSortManager } from "$lib/SortManager/AchievementSortManager";

	let { children } = $props();

	setAchievementClientSortManager();
</script>

{@render children()}
