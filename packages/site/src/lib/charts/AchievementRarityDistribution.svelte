<script lang="ts">
	import type { SteamAppAchievement, SteamUserAchievement } from "@project/lib";
	import { BarChart } from "layerchart/svg";
	import { m } from "$lib/paraglide/messages";

	type Achievement = SteamAppAchievement | SteamUserAchievement;
	type Bucket = {
		label: string;
		minimum: number;
		maximum: number;
		total: number;
		unlocked: number;
		locked: number;
		selected: boolean;
	};

	let {
		achievements,
		currentAchievementId,
	}: {
		achievements: Achievement[];
		currentAchievementId?: string;
	} = $props();

	const ranges = [
		[0, 1],
		[1, 5],
		[5, 10],
		[10, 25],
		[25, 50],
		[50, 100],
	] as const;

	let hasUserProgress = $derived(achievements.some((achievement) => "unlocked" in achievement));
	let buckets = $derived.by<Bucket[]>(() =>
		ranges.map(([minimum, maximum], index) => {
			const members = achievements.filter((achievement) => {
				const percentage = achievement.globalPercentage;
				return (
					percentage >= minimum &&
					(index === ranges.length - 1 ? percentage <= maximum : percentage < maximum)
				);
			});
			const unlocked = members.filter(
				(achievement) => "unlocked" in achievement && achievement.unlocked != null,
			).length;

			return {
				label: `${minimum}–${maximum}%`,
				minimum,
				maximum,
				total: members.length,
				unlocked,
				locked: members.length - unlocked,
				selected: members.some((achievement) => achievement.id === currentAchievementId),
			};
		}),
	);
	let maxCount = $derived(Math.max(1, ...buckets.map((bucket) => bucket.total)));
	let selectedAchievement = $derived(
		currentAchievementId ? achievements.find((achievement) => achievement.id === currentAchievementId) : undefined,
	);
	let selectedRank = $derived(
		selectedAchievement
			? achievements.filter((achievement) => achievement.globalPercentage < selectedAchievement.globalPercentage)
					.length + 1
			: null,
	);
</script>

<div class="space-y-3">
	{#if selectedAchievement && selectedRank}
		<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
			<div class="text-surface-300">
				<span class="text-surface-100 font-semibold tabular-nums">#{selectedRank}</span>
				/
				<span class="tabular-nums">{achievements.length}</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="bg-primary-500 size-2.5 rounded-full" aria-hidden="true"></span>
				<span class="text-surface-300">{m["achievement.thisAchievement.label"]()}</span>
			</div>
		</div>
	{/if}

	<figure class="space-y-2" aria-label={m["achievement.rarityComparison.title"]()}>
		<div class="border-surface-700 bg-surface-900/40 h-52 overflow-hidden rounded border p-2">
			<BarChart
				data={buckets}
				x="label"
				y="total"
				yDomain={[0, Math.ceil(maxCount * 1.1)]}
				axis={false}
				grid={true}
				rule={false}
				highlight={false}
				tooltipContext={false}
				bandPadding={0.2}
				seriesLayout="stack"
				series={hasUserProgress
					? [
							{
								key: "unlocked",
								label: m["chart.unlockedAchievements.label"](),
								value: "unlocked",
								color: "var(--color-primary-500)",
							},
							{
								key: "locked",
								label: m["status.locked"](),
								value: "locked",
								color: "var(--color-surface-600)",
							},
						]
					: [
							{
								key: "total",
								label: m["chart.achievements.label"](),
								value: "total",
								color: "var(--color-primary-500)",
							},
						]}
				padding={{ top: 12, right: 12, bottom: 8, left: 12 }}
			/>
		</div>

		<ul class="sr-only">
			{#each buckets as bucket (bucket.label)}
				<li>
					{bucket.label}: {bucket.total} {m["chart.achievements.label"]()}
					{#if hasUserProgress}
						, {bucket.unlocked} {m["chart.unlockedAchievements.label"]()}
					{/if}
				</li>
			{/each}
		</ul>

		<figcaption class="grid grid-cols-3 gap-1 text-center text-xs sm:grid-cols-6">
			{#each buckets as bucket (bucket.label)}
				<div
					class="rounded px-1 py-1.5 tabular-nums"
					class:bg-primary-500={bucket.selected}
					class:text-surface-950={bucket.selected}
					class:bg-surface-900={bucket.selected === false}
				>
					<span class="block font-medium">{bucket.label}</span>
					<span class:font-bold={bucket.selected}>{bucket.total}</span>
				</div>
			{/each}
		</figcaption>
	</figure>

	{#if hasUserProgress}
		<div class="text-surface-300 flex flex-wrap gap-x-4 gap-y-1 text-xs">
			<span class="flex items-center gap-1.5">
				<span class="bg-primary-500 size-2.5 rounded-sm" aria-hidden="true"></span>
				{m["chart.unlockedAchievements.label"]()}
			</span>
			<span class="flex items-center gap-1.5">
				<span class="bg-surface-600 size-2.5 rounded-sm" aria-hidden="true"></span>
				{m["status.locked"]()}
			</span>
		</div>
	{/if}
</div>
