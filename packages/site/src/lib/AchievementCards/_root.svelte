<script lang="ts">
	import type { SteamAppAchievement, SteamUserAchievement } from "lib";
	import { flip } from "svelte/animate";
	import { quintOut } from "svelte/easing";
	import { crossfade } from "svelte/transition";
	import { getAchievementSortManager } from "$lib/SortManager/AchievementSortManager";
	import Transition from "$lib/Transition.svelte";
	import Card from "./_card.svelte";
	import Placeholder from "./_placeholder.svelte";

	// 30 :P because it is a multiple of 3 & 2 & 1, so CSS grid can handle it well
	const ACHIEVEMENT_COUNT = 30;

	interface Props {
		achievements: MaybePromise<Array<SteamUserAchievement | SteamAppAchievement>>;
		secondary?: boolean;
	}
	let { achievements, secondary = false }: Props = $props();

	const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

	const [send, receive] = crossfade({
		duration: (d) => Math.sqrt(d * 200),

		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === "none" ? "" : style.transform;

			return {
				duration: 300,
				easing: quintOut,
				css: (t) => `transform: ${transform} translateY(${(1 - t) * 100}px); opacity: ${t}`,
			};
		},
	});

	const sortManager = getAchievementSortManager();

	// State caching - track the last resolved data and loading state
	let cachedAchievements: Array<SteamUserAchievement | SteamAppAchievement> | null = $state(null);
	let isLoading = $state(false);

	// Update cached data when new data resolves, and track loading state
	$effect(() => {
		const currentData = achievements;

		(async () => {
			// It's a promise - mark as loading
			isLoading = true;

			try {
				// Wait for the promise to resolve
				const resolvedAchievements = await currentData;
				cachedAchievements = resolvedAchievements;
			} catch (error) {
				// If it fails, keep the cached data and set loading to false
				console.error("Failed to load achievements:", error);
			} finally {
				isLoading = false;
			}
		})();
	});
</script>

{#if !cachedAchievements}
	<!-- Initial loading state - no cached data available -->
	<div class={grid}>
		{#each new Array(6) as _, i (i)}
			<Placeholder {secondary} />
		{/each}
	</div>
{:else}
	{@const sortedAchievements = sortManager.sort(cachedAchievements) as Array<
		SteamUserAchievement | SteamAppAchievement
	>}
	<div class={grid} class:opacity-75={isLoading} class:pointer-events-none={isLoading}>
		{#if !sortedAchievements || sortedAchievements.length === 0}
			<Transition>
				<!-- No achievements available -->
				<div class="card p-8 text-center">
					<h3 class="mb-2 text-xl font-bold">No achievements found</h3>
					<p class="text-surface-300 mx-auto max-w-md">No achievements available.</p>
				</div>
			</Transition>
		{:else}
			<!-- Show cached achievements -->
			{#each sortedAchievements.slice(0, ACHIEVEMENT_COUNT) as achievement (achievement.id + achievement.app.id)}
				<div
					in:receive={{ key: achievement.id + achievement.app.id }}
					out:send={{ key: achievement.id + achievement.app.id }}
					animate:flip={{ duration: 200 }}
				>
					<Card {achievement} {secondary} />
				</div>
			{/each}

			<!-- Fill remaining spaces with placeholders while loading -->
			{#if isLoading && sortedAchievements.length < ACHIEVEMENT_COUNT}
				{#each new Array(ACHIEVEMENT_COUNT - sortedAchievements.length) as _, i (i + 1000)}
					<Placeholder {secondary} />
				{/each}
			{/if}
		{/if}
	</div>
{/if}
