<script lang="ts" module>
	const numberFormat = new Intl.NumberFormat(getLocale(), {
		style: "decimal",
		notation: "compact",
		maximumFractionDigits: 0,
	});

	function formatDaysSinceUnlocked(days: number) {
		if ("DurationFormat" in Intl) {
			const locale = getLocale();
			const durationFormat = new Intl.DurationFormat(locale, {
				style: locale === "ja" ? "short" : "narrow",
			});

			return durationFormat.format({ days });
		}

		return `${numberFormat.format(days)}d`;
	}
</script>

<script lang="ts">
	import Lock from "@lucide/svelte/icons/lock";
	import type { SteamAppAchievement } from "@project/lib";
	import { SteamUserAchievement } from "@project/lib";
	import { m } from "$lib/paraglide/messages.js";
	import { getLocale } from "$lib/paraglide/runtime";
	import { getRarity } from "$lib/rarity";
	import { getAchievementSortManager } from "$lib/SortManager/AchievementSortManager";

	interface Props {
		achievement: SteamUserAchievement | SteamAppAchievement;
	}
	let { achievement }: Props = $props();

	const sortManager = getAchievementSortManager();

	const rarity = $derived(getRarity(achievement.globalPercentage));
</script>

<div class="badge bg-{rarity} text-surface-900 heading-line-height px-1.5 py-0 text-xs font-bold">
	{#if sortManager.method === "rarity_pct"}
		{#if achievement.globalPercentage < 0.1}
			&lt;0.1%
		{:else}
			{achievement.globalPercentage}%
		{/if}
	{:else if sortManager.method === "rarity_score"}
		{#if achievement.globalCount === null}
			???
		{:else if achievement.app.estimatedPlayers !== null && achievement.app.estimatedPlayers < 0}
			???
		{:else if achievement.app.estimatedPlayers !== null && achievement.globalPercentage < 0.1}
			&lt;{numberFormat.format(achievement.app.estimatedPlayers * 0.001)}
		{:else}
			{numberFormat.format(achievement.globalCount)}
		{/if}
	{:else if sortManager.method === "unlocked_at" && achievement instanceof SteamUserAchievement}
		<!-- show days elapsed since -->
		{#if achievement.unlocked}
			{@const daysSinceUnlocked = Math.floor(
				(Date.now() - achievement.unlocked.getTime()) /
					(1000 * 60 * 60 * 24),
			)}
			{formatDaysSinceUnlocked(daysSinceUnlocked)}
		{:else}
			<Lock class="m-[0.2em] h-[1em] w-auto" />
			<span hidden>{m["status.locked"]()}</span>
		{/if}
	{/if}
</div>
