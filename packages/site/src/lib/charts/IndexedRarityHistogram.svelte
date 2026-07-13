<script lang="ts">
	import Crown from "@lucide/svelte/icons/crown";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import { BarChart } from "layerchart/svg";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";

	let { counts }: { counts: [number, number, number, number, number, number] } = $props();

	const labels = ["0–1%", "1–5%", "5–10%", "10–25%", "25–50%", "50–100%"] as const;
	const compactNumberFormat = new Intl.NumberFormat(getLocale(), {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const exactNumberFormat = new Intl.NumberFormat(getLocale());
	const percentageValueFormat = new Intl.NumberFormat(getLocale(), {
		maximumFractionDigits: 1,
	});
	const formatPercentageValue = (value: number) => percentageValueFormat.format(value * 100);

	let buckets = $derived(labels.map((label, index) => ({ label, count: counts[index] ?? 0 })));
	let maxCount = $derived(Math.max(1, ...buckets.map((bucket) => bucket.count)));
	let totalCount = $derived(buckets.reduce((total, bucket) => total + bucket.count, 0));
	let ultraRareCount = $derived((counts[0] ?? 0) + (counts[1] ?? 0));
	let ultraRareRatio = $derived(totalCount === 0 ? 0 : ultraRareCount / totalCount);
	let dominantBucket = $derived(
		buckets.reduce(
			(largest, bucket) => (bucket.count > largest.count ? bucket : largest),
			buckets[0] ?? { label: labels[0], count: 0 },
		),
	);
	let entered = $state(false);

	const observeChart = (node: HTMLElement) => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			entered = true;
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					entered = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.25 },
		);
		observer.observe(node);

		return {
			destroy: () => observer.disconnect(),
		};
	};
</script>

<div class="space-y-5" use:observeChart>
	<div class="flex flex-wrap items-end justify-between gap-2">
		<h2 class="text-xl font-bold">{m["achievement.rarityComparison.title"]()}</h2>
		<div class="text-surface-300 text-sm tabular-nums" title={exactNumberFormat.format(totalCount)}>
			<span class="text-surface-100 font-semibold">{compactNumberFormat.format(totalCount)}</span>
			{m["chart.achievements.label"]()}
		</div>
	</div>
	<p class="text-surface-300 -mt-3 max-w-3xl text-sm">
		{m["home.stats.rarityHistogramDescription"]()}
	</p>

	<div class="grid gap-2 sm:grid-cols-2">
		<div
			class="border-primary-500/30 from-primary-500/15 to-primary-500/5 flex items-center gap-3 rounded border bg-gradient-to-r p-3"
		>
			<div class="bg-primary-500/15 rounded-full p-2">
				<Sparkles class="text-primary-400 size-5" aria-hidden="true" />
			</div>
			<div>
				<div class="text-primary-300 text-xs font-semibold">{m["chart.rarity.ultraRare"]()}</div>
				<div class="mt-0.5 text-2xl font-bold tabular-nums">
					{compactNumberFormat.format(ultraRareCount)}
					<span class="text-surface-300 text-xs font-normal">{m["chart.achievements.label"]()}</span>
				</div>
				<div class="text-surface-400 text-xs tabular-nums">
					{formatPercentageValue(ultraRareRatio)} {m["chart.after.label.suffix"]()}
				</div>
			</div>
		</div>

		<div class="border-surface-700 bg-surface-900/70 flex items-center gap-3 rounded border p-3">
			<div class="bg-surface-700/60 rounded-full p-2">
				<Crown class="text-primary-400 size-5" aria-hidden="true" />
			</div>
			<div>
				<div class="text-2xl font-bold tabular-nums">{dominantBucket.label}</div>
				<div class="text-surface-300 text-xs" title={exactNumberFormat.format(dominantBucket.count)}>
					{compactNumberFormat.format(dominantBucket.count)} {m["chart.achievements.label"]()}
				</div>
			</div>
		</div>
	</div>

	<div class="text-surface-300 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
		<span class="flex items-center gap-1.5">
			<span class="text-primary-400 text-base leading-none font-bold" aria-hidden="true">↑</span>
			{m["chart.achievements.label"]()}
		</span>
		<span class="flex items-center gap-1.5">
			<span class="text-primary-400 text-base leading-none font-bold" aria-hidden="true">→</span>
			% {m["achievement.ofPlayers"]()}
		</span>
	</div>

	<figure class="space-y-3" aria-label={m["achievement.rarityComparison.title"]()}>
		<div
			class:entered
			class="histogram border-surface-700 bg-surface-950/30 relative h-56 overflow-hidden rounded border p-2 sm:h-64"
		>
			<div
				class="border-primary-500/20 bg-primary-500/5 pointer-events-none absolute inset-y-2 left-2 w-[calc((100%-1rem)/3)] rounded border"
				aria-hidden="true"
			>
				<div
					class="text-primary-300 flex items-center gap-1 px-2 pt-1 text-[0.65rem] font-semibold tracking-wide uppercase"
				>
					<Sparkles class="size-3" />
					{m["chart.rarity.ultraRare"]()}
				</div>
			</div>

			<BarChart
				data={buckets}
				x="label"
				y="count"
				yDomain={[0, Math.ceil(maxCount * 1.1)]}
				axis={false}
				grid={true}
				rule={false}
				highlight={false}
				tooltipContext={false}
				bandPadding={0.18}
				series={[
					{
						key: "count",
						label: m["chart.achievements.label"](),
						value: "count",
						color: "var(--color-primary-500)",
						props: { radius: 4, rounded: "top" },
					},
				]}
				padding={{ top: 34, right: 12, bottom: 8, left: 12 }}
			/>
		</div>

		<ul class="sr-only">
			{#each buckets as bucket (bucket.label)}
				<li>{bucket.label}: {exactNumberFormat.format(bucket.count)} {m["chart.achievements.label"]()}</li>
			{/each}
		</ul>

		<figcaption class="grid grid-cols-3 gap-1.5 text-center text-xs sm:grid-cols-6">
			{#each buckets as bucket, index (bucket.label)}
				<div
					class="rounded border px-1 py-2 tabular-nums {index < 2
						? 'border-primary-500/25 bg-primary-500/5'
						: 'border-surface-800 bg-surface-900'}"
				>
					<span class="text-surface-200 block font-medium">{bucket.label}</span>
					<span class="text-surface-400 block" title={exactNumberFormat.format(bucket.count)}>
						{compactNumberFormat.format(bucket.count)}
					</span>
				</div>
			{/each}
		</figcaption>
	</figure>
</div>

<style>
	.histogram :global(.lc-bars .lc-bar) {
		transform-box: fill-box;
		transform-origin: center bottom;
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(1)) {
		fill: var(--color-primary-300);
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(2)) {
		fill: var(--color-primary-400);
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(3)) {
		fill: var(--color-primary-500);
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(4)) {
		fill: var(--color-primary-600);
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(5)) {
		fill: var(--color-surface-500);
	}

	.histogram :global(.lc-bars .lc-bar:nth-child(6)) {
		fill: var(--color-surface-600);
	}

	.histogram:not(.entered) :global(.lc-bars .lc-bar) {
		opacity: 0;
		transform: scaleY(0);
	}

	.histogram.entered :global(.lc-bars .lc-bar) {
		animation: rise 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.histogram.entered :global(.lc-bars .lc-bar:nth-child(2)) {
		animation-delay: 60ms;
	}

	.histogram.entered :global(.lc-bars .lc-bar:nth-child(3)) {
		animation-delay: 120ms;
	}

	.histogram.entered :global(.lc-bars .lc-bar:nth-child(4)) {
		animation-delay: 180ms;
	}

	.histogram.entered :global(.lc-bars .lc-bar:nth-child(5)) {
		animation-delay: 240ms;
	}

	.histogram.entered :global(.lc-bars .lc-bar:nth-child(6)) {
		animation-delay: 300ms;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: scaleY(0);
		}
		to {
			opacity: 1;
			transform: scaleY(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.histogram :global(.lc-bars .lc-bar) {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
