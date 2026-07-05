<script lang="ts">
	import Activity from "@lucide/svelte/icons/activity";
	import type { SteamChartsSnapshot } from "@project/lib";
	import { LineChart } from "layerchart/svg";

	type ActivityPoint = {
		index: number;
		timestamp: number;
		players: number;
	};

	let { snapshot } = $props<{
		snapshot: SteamChartsSnapshot | null;
	}>();

	const unixMillisecondsThreshold = 10_000_000_000;
	const dayMs = 60 * 60 * 24 * 1000;
	const numberFormat = new Intl.NumberFormat(undefined, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const exactNumberFormat = new Intl.NumberFormat();
	const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
	const updatedFormat = new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

	const toUnixMilliseconds = (timestamp: number) =>
		timestamp >= unixMillisecondsThreshold ? timestamp : timestamp * 1000;
	const toSnapshotDate = (value: Date) => (value instanceof Date ? value : new Date(value));
	const formatCount = (value: number | null | undefined) =>
		value == null ? "--" : numberFormat.format(Math.round(value));
	const formatExact = (value: number | null | undefined) =>
		value == null ? "--" : exactNumberFormat.format(Math.round(value));
	const formatPointDate = (timestamp: number | null | undefined) =>
		timestamp == null ? "" : dateFormat.format(new Date(toUnixMilliseconds(timestamp)));

	let points = $derived.by<ActivityPoint[]>(() =>
		(snapshot?.recentPoints ?? [])
			.map((point: [number, number], index: number) => {
				const [timestamp, players] = point;
				return { index, timestamp, players };
			})
			.toSorted((a: ActivityPoint, b: ActivityPoint) => a.timestamp - b.timestamp),
	);
	let latestPoint = $derived(points.at(-1));
	let firstPoint = $derived(points[0]);
	let updatedAt = $derived(snapshot ? toSnapshotDate(snapshot.updatedAt) : null);
	let dayPeak = $derived.by<number | null>(() => {
		if (!updatedAt) return null;
		const cutoff = updatedAt.getTime() - dayMs;
		const recentValues = points
			.filter((point) => toUnixMilliseconds(point.timestamp) >= cutoff)
			.map((point) => point.players);
		return recentValues.length > 0 ? Math.max(...recentValues) : null;
	});
	let maxPlayers = $derived(Math.max(1, ...points.map((point) => point.players)));
	let yDomain = $derived([0, Math.ceil(maxPlayers * 1.1)] as [number, number]);
	let yTickLabels = $derived([yDomain[1], yDomain[1] / 2, 0]);
	let xTickLabels = $derived.by<ActivityPoint[]>(() => {
		const midpoint = points[Math.floor((points.length - 1) / 2)];
		const candidates = [firstPoint, midpoint, latestPoint].filter((point): point is ActivityPoint => point != null);

		return candidates.filter(
			(point, index, allPoints) => allPoints.findIndex((candidate) => candidate.index === point.index) === index,
		);
	});
	let hasTrend = $derived(points.length > 1);
</script>

<div class="space-y-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="mb-1 text-xl font-bold">Player activity</h2>
			<p class="text-sm text-surface-300">Concurrent players sampled from SteamCharts.</p>
		</div>
		<Activity class="mt-1 h-5 w-5 shrink-0 text-primary-400" aria-hidden="true" />
	</div>

	{#if snapshot && hasTrend}
		<div class="grid grid-cols-3 gap-2 text-sm">
			<div class="rounded bg-surface-900/60 p-3">
				<div class="text-surface-400">Latest sample</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(latestPoint?.players)}>
					{formatCount(latestPoint?.players)}
				</div>
			</div>
			<div class="rounded bg-surface-900/60 p-3">
				<div class="text-surface-400">24h peak</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(dayPeak)}>
					{formatCount(dayPeak)}
				</div>
			</div>
			<div class="rounded bg-surface-900/60 p-3">
				<div class="text-surface-400">All-time peak</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(snapshot.allTimePeak)}>
					{formatCount(snapshot.allTimePeak)}
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-300">
			<span class="inline-flex items-center gap-2">
				<span class="h-0.5 w-5 rounded-full bg-primary-500"></span>
				Concurrent players
			</span>
			<span class="text-surface-500">Grid lines mark player count</span>
		</div>

		<div class="h-44 overflow-hidden rounded border border-surface-700 bg-surface-900/40 p-2">
			<div class="grid h-full grid-cols-[3.5rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_1.25rem] gap-x-2 gap-y-1">
				<div class="flex h-full flex-col justify-between py-1 text-right text-xs font-normal text-surface-200">
					{#each yTickLabels as tick}
						<span>{formatCount(tick)}</span>
					{/each}
				</div>
				<div class="min-w-0">
					<LineChart
						data={points}
						x="index"
						y="players"
						{yDomain}
						axis={false}
						grid={true}
						highlight={false}
						tooltipContext={false}
						padding={{ top: 8, right: 8, bottom: 8, left: 0 }}
						series={[
							{
								key: "players",
								label: "Concurrent players",
								value: "players",
								color: "var(--color-primary-500)",
							},
						]}
						props={{ spline: { class: "stroke-2" } }}
					/>
				</div>
				<div></div>
				<div class="flex items-start justify-between text-xs font-normal text-surface-400">
					{#each xTickLabels as point (point.index)}
						<span>{formatPointDate(point.timestamp)}</span>
					{/each}
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-surface-400">
			<span>{formatPointDate(firstPoint?.timestamp)} - {formatPointDate(latestPoint?.timestamp)}</span>
			{#if updatedAt}
				<span>Updated {updatedFormat.format(updatedAt)}</span>
			{/if}
		</div>
	{:else}
		<div class="rounded border border-dashed border-surface-700 bg-surface-900/30 p-4 text-sm text-surface-300">
			Player activity will appear after the next SteamCharts-backed estimate refresh.
		</div>
	{/if}
</div>
