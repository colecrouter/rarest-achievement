<script lang="ts">
	import Activity from "@lucide/svelte/icons/activity";
	import type { SteamChartsSnapshot } from "@project/lib";
	import { LineChart } from "layerchart/svg";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";

	type ActivityPoint = {
		timestampMs: number;
		players: number;
	};

	let { snapshot } = $props<{
		snapshot: SteamChartsSnapshot | null;
	}>();

	const locale = getLocale();
	const compactNumberFormat = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const exactNumberFormat = new Intl.NumberFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
	const updatedFormat = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const toUnixMilliseconds = (timestamp: number) => (timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
	const formatCompact = (value: number | null | undefined) =>
		value == null ? "--" : compactNumberFormat.format(Math.round(value));
	const formatExact = (value: number | null | undefined) =>
		value == null ? "--" : exactNumberFormat.format(Math.round(value));
	const formatPointDate = (timestampMs: number | null | undefined) =>
		timestampMs == null ? "" : dateFormat.format(new Date(timestampMs));

	let points = $derived.by<ActivityPoint[]>(() =>
		(snapshot?.recentPoints ?? [])
			.map((point: [number, number]): ActivityPoint => {
				const [timestamp, players] = point;
				return {
					timestampMs: toUnixMilliseconds(timestamp),
					players,
				};
			})
			.filter(
				(point: ActivityPoint) =>
					Number.isFinite(point.timestampMs) && Number.isFinite(point.players) && point.players >= 0,
			)
			.toSorted((a: ActivityPoint, b: ActivityPoint) => a.timestampMs - b.timestampMs),
	);
	let firstPoint = $derived(points[0]);
	let latestPoint = $derived(points.at(-1));
	let midpoint = $derived(points[Math.floor((points.length - 1) / 2)]);
	let hasTrend = $derived(points.length > 1 && firstPoint?.timestampMs !== latestPoint?.timestampMs);
	let updatedAt = $derived(snapshot ? new Date(snapshot.updatedAt) : null);
	let maxPlayers = $derived(Math.max(1, ...points.map((point) => point.players)));
	let yDomain = $derived([0, Math.ceil(maxPlayers * 1.1)] as [number, number]);
	let xDomain = $derived(
		hasTrend ? ([firstPoint?.timestampMs ?? 0, latestPoint?.timestampMs ?? 0] as [number, number]) : undefined,
	);
	let yTickLabels = $derived([yDomain[1], yDomain[1] / 2, 0]);
	let xTickLabels = $derived.by<ActivityPoint[]>(() => {
		const candidates = [firstPoint, midpoint, latestPoint].filter((point): point is ActivityPoint => point != null);
		return candidates.filter(
			(point, index, allPoints) =>
				allPoints.findIndex((candidate) => candidate.timestampMs === point.timestampMs) === index,
		);
	});
</script>

<div class="space-y-5">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="mb-1 text-xl font-bold">{m["game.playerActivity.title"]()}</h2>
			<p class="text-surface-300 text-sm">{m["game.playerActivity.description"]()}</p>
		</div>
		<Activity class="text-primary-400 mt-1 size-5 shrink-0" aria-hidden="true" />
	</div>

	{#if snapshot && hasTrend}
		<div class="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
			<div class="bg-surface-900/60 rounded p-3">
				<div class="text-surface-400">{m["game.playerActivity.latestSample"]()}</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(latestPoint?.players)}>
					{formatCompact(latestPoint?.players)}
				</div>
			</div>
			<div class="bg-surface-900/60 rounded p-3">
				<div class="text-surface-400">{m["game.playerActivity.dayPeak"]()}</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(snapshot.dayPeak)}>
					{formatCompact(snapshot.dayPeak)}
				</div>
			</div>
			<div class="bg-surface-900/60 rounded p-3">
				<div class="text-surface-400">{m["game.playerActivity.average"]()}</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(snapshot.avgCount)}>
					{formatCompact(snapshot.avgCount)}
				</div>
			</div>
			<div class="bg-surface-900/60 rounded p-3">
				<div class="text-surface-400">{m["game.playerActivity.allTimePeak"]()}</div>
				<div class="mt-1 text-lg font-semibold tabular-nums" title={formatExact(snapshot.allTimePeak)}>
					{formatCompact(snapshot.allTimePeak)}
				</div>
			</div>
		</div>

		<figure
			class="space-y-2"
			aria-label={`${m["game.playerActivity.series"]()}: ${formatExact(latestPoint?.players)}`}
		>
			<div class="text-surface-300 flex items-center gap-2 text-xs">
				<span class="bg-primary-500 h-0.5 w-5 rounded-full" aria-hidden="true"></span>
				<span>{m["game.playerActivity.series"]()}</span>
			</div>

			<div class="border-surface-700 bg-surface-900/40 h-56 overflow-hidden rounded border p-2">
				<div
					class="grid h-full grid-cols-[3.5rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_1.25rem] gap-x-2 gap-y-1"
				>
					<div class="text-surface-300 flex h-full flex-col justify-between py-1 text-right text-xs">
						{#each yTickLabels as tick}
							<span>{formatCompact(tick)}</span>
						{/each}
					</div>
					<div class="min-w-0">
						<LineChart
							data={points}
							x="timestampMs"
							y="players"
							{xDomain}
							{yDomain}
							axis={false}
							grid={true}
							highlight={false}
							tooltipContext={false}
							padding={{ top: 8, right: 8, bottom: 8, left: 0 }}
							series={[
								{
									key: "players",
									label: m["game.playerActivity.series"](),
									value: "players",
									color: "var(--color-primary-500)",
								},
							]}
							props={{ spline: { class: "stroke-2" } }}
						/>
					</div>
					<div></div>
					<div class="text-surface-400 flex items-start justify-between text-xs">
						{#each xTickLabels as point (point.timestampMs)}
							<span>{formatPointDate(point.timestampMs)}</span>
						{/each}
					</div>
				</div>
			</div>

			<figcaption class="text-surface-400 flex flex-wrap items-center justify-between gap-2 text-xs">
				<span>{formatPointDate(firstPoint?.timestampMs)} - {formatPointDate(latestPoint?.timestampMs)}</span>
				{#if updatedAt && !Number.isNaN(updatedAt.getTime())}
					<time datetime={updatedAt.toISOString()}>
						{m["game.playerActivity.updated"]({ date: updatedFormat.format(updatedAt) })}
					</time>
				{/if}
			</figcaption>
		</figure>
	{:else}
		<div class="border-surface-700 bg-surface-900/30 text-surface-300 rounded border border-dashed p-4 text-sm">
			{m["game.playerActivity.unavailable"]()}
		</div>
	{/if}
</div>
