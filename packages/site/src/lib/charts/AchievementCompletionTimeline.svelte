<script lang="ts">
	import type { SteamUserAchievement } from "@project/lib";
	import { AreaChart } from "layerchart/svg";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";

	type TimelinePoint = {
		dateMs: number;
		unlocked: number;
	};

	let {
		achievements,
		totalCount,
	}: {
		achievements: SteamUserAchievement[];
		totalCount: number;
	} = $props();

	const locale = getLocale();
	const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });

	let points = $derived.by<TimelinePoint[]>(() => {
		const unlocksByDay = new Map<number, number>();
		for (const achievement of achievements) {
			if (!achievement.unlocked) continue;
			const unlocked = achievement.unlocked;
			const day = new Date(unlocked.getFullYear(), unlocked.getMonth(), unlocked.getDate()).getTime();
			unlocksByDay.set(day, (unlocksByDay.get(day) ?? 0) + 1);
		}

		let cumulative = 0;
		return [...unlocksByDay.entries()]
			.toSorted(([a], [b]) => a - b)
			.map(([dateMs, count]) => {
				cumulative += count;
				return { dateMs, unlocked: cumulative };
			});
	});
	let firstPoint = $derived(points[0]);
	let latestPoint = $derived(points.at(-1));
	let midpoint = $derived(points[Math.floor((points.length - 1) / 2)]);
	let hasTimeline = $derived(points.length > 1 && firstPoint?.dateMs !== latestPoint?.dateMs);
	let xLabels = $derived(
		[firstPoint, midpoint, latestPoint]
			.filter((point): point is TimelinePoint => point != null)
			.filter((point, index, all) => all.findIndex((candidate) => candidate.dateMs === point.dateMs) === index),
	);
	let yMaximum = $derived(Math.max(1, totalCount));
</script>

{#if hasTimeline}
	<figure
		class="space-y-2"
		aria-label={`${m["game.achievementProgress.title"]()}: ${latestPoint?.unlocked ?? 0} / ${totalCount}`}
	>
		<div class="border-surface-700 bg-surface-900/40 h-52 overflow-hidden rounded border p-2">
			<div class="grid h-full grid-cols-[2.5rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_1.25rem] gap-x-2 gap-y-1">
				<div class="text-surface-400 flex h-full flex-col justify-between py-1 text-right text-xs tabular-nums">
					<span>{yMaximum}</span>
					<span>{Math.round(yMaximum / 2)}</span>
					<span>0</span>
				</div>
				<div class="min-w-0">
					<AreaChart
						data={points}
						x="dateMs"
						y="unlocked"
						xDomain={[firstPoint?.dateMs ?? 0, latestPoint?.dateMs ?? 0]}
						yDomain={[0, yMaximum]}
						axis={false}
						grid={true}
						highlight={false}
						tooltipContext={false}
						padding={{ top: 8, right: 8, bottom: 8, left: 0 }}
						series={[
							{
								key: "unlocked",
								label: m["chart.unlockedAchievements.label"](),
								value: "unlocked",
								color: "var(--color-primary-500)",
							},
						]}
						props={{ area: { opacity: 0.28 }, spline: { class: "stroke-2" } }}
					/>
				</div>
				<div></div>
				<div class="text-surface-400 flex items-start justify-between text-xs">
					{#each xLabels as point (point.dateMs)}
						<time datetime={new Date(point.dateMs).toISOString()}>{dateFormat.format(point.dateMs)}</time>
					{/each}
				</div>
			</div>
		</div>
	</figure>
{/if}
