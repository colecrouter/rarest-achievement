<script lang="ts">
	import Activity from "@lucide/svelte/icons/activity";
	import type { SteamChartsSnapshot } from "@project/lib";
	import type { AnnotationLineProps, AnnotationPointProps } from "layerchart/svg";
	import { AreaChart } from "layerchart/svg";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";

	type ActivityPoint = {
		timestampMs: number;
		players: number;
	};
	type ActivityAnnotation =
		| ({ type: "line"; layer?: "above" | "below" } & AnnotationLineProps)
		| ({ type: "point"; layer?: "above" | "below" } & AnnotationPointProps);

	let { snapshot } = $props<{
		snapshot: SteamChartsSnapshot | null;
	}>();

	const locale = getLocale();
	const compactNumberFormat = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const exactNumberFormat = new Intl.NumberFormat(locale);
	const signedCompactNumberFormat = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
		signDisplay: "always",
	});
	const signedPercentFormat = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		signDisplay: "always",
		style: "percent",
	});
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
	const formatSignedCompact = (value: number | null | undefined) =>
		value == null ? "--" : signedCompactNumberFormat.format(Math.round(value));
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
	let periodPeak = $derived(
		points.reduce<ActivityPoint | undefined>(
			(peak, point) => (!peak || point.players > peak.players ? point : peak),
			undefined,
		),
	);
	let recentAverage = $derived(
		points.length === 0 ? 0 : points.reduce((total, point) => total + point.players, 0) / points.length,
	);
	let playerChange = $derived(firstPoint && latestPoint ? latestPoint.players - firstPoint.players : null);
	let playerChangeRatio = $derived(
		playerChange != null && firstPoint && firstPoint.players > 0 ? playerChange / firstPoint.players : null,
	);
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
	let annotations = $derived.by(() => {
		const result: ActivityAnnotation[] = [
			{
				type: "line" as const,
				layer: "below" as const,
				y: recentAverage,
				props: {
					line: {
						stroke: "var(--color-surface-400)",
						dashArray: "5 5",
						strokeWidth: 1,
					},
				},
			},
		];

		if (periodPeak && periodPeak.timestampMs !== latestPoint?.timestampMs) {
			result.push({
				type: "point" as const,
				layer: "above" as const,
				x: periodPeak.timestampMs,
				y: periodPeak.players,
				label: formatCompact(periodPeak.players),
				labelPlacement: "top-right" as const,
				labelXOffset: 5,
				labelYOffset: 5,
				props: {
					circle: {
						fill: "var(--color-surface-100)",
						stroke: "var(--color-surface-900)",
						strokeWidth: 2,
					},
					label: { fill: "var(--color-surface-200)" },
				},
			});
		}

		if (latestPoint) {
			result.push({
				type: "point" as const,
				layer: "above" as const,
				x: latestPoint.timestampMs,
				y: latestPoint.players,
				label: formatCompact(latestPoint.players),
				labelPlacement: "top-left" as const,
				labelXOffset: 6,
				labelYOffset: 5,
				props: {
					circle: {
						fill: "var(--color-primary-500)",
						stroke: "var(--color-surface-900)",
						strokeWidth: 2,
					},
					label: { fill: "var(--color-surface-100)", "font-weight": 600 },
				},
			});
		}

		return result;
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
				{#if playerChange != null}
					<div
						class="text-xs font-medium tabular-nums"
						class:text-green-400={playerChange > 0}
						class:text-red-400={playerChange < 0}
						class:text-surface-400={playerChange === 0}
						title={formatSignedCompact(playerChange)}
					>
						{playerChangeRatio == null ? formatSignedCompact(playerChange) : signedPercentFormat.format(playerChangeRatio)}
					</div>
				{/if}
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
			<div class="text-surface-300 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
				<span class="flex items-center gap-2">
					<span class="bg-primary-500 h-0.5 w-5 rounded-full" aria-hidden="true"></span>
					<span>{m["game.playerActivity.series"]()}</span>
				</span>
				<span class="flex items-center gap-2">
					<span class="border-surface-400 w-5 border-t border-dashed" aria-hidden="true"></span>
					<span>{m["game.playerActivity.average"]()}: {formatCompact(recentAverage)}</span>
				</span>
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
						<AreaChart
							data={points}
							x="timestampMs"
							y="players"
							{xDomain}
							{yDomain}
							axis={false}
							grid={true}
							highlight={false}
							tooltipContext={false}
							{annotations}
							padding={{ top: 8, right: 8, bottom: 8, left: 0 }}
							series={[
								{
									key: "players",
									label: m["game.playerActivity.series"](),
									value: "players",
									color: "var(--color-primary-500)",
								},
							]}
							props={{ area: { fillOpacity: 0.22 }, spline: { class: "stroke-2" } }}
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
