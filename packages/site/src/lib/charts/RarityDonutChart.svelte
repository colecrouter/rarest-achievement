<script lang="ts">
	import type { Rarity } from "$lib/rarity";

	type Bucket = {
		key: Rarity;
		label: string;
		total: number;
		unlocked: number;
	};

	let { buckets, unlockedCount, totalCount } = $props<{
		buckets: Bucket[];
		unlockedCount: number;
		totalCount: number;
	}>();

	const colorFor = (key: Rarity, tone: "base" | "dark" = "base") =>
		`var(--color-${key}${tone === "base" ? "" : `-${tone}`})`;

	let unlockedPercent = $derived(totalCount === 0 ? 0 : (unlockedCount / totalCount) * 100);
	let progressBuckets = $derived(
		buckets.map((bucket: Bucket) => ({
			...bucket,
			progressValue: bucket.key === "locked" ? totalCount - unlockedCount : bucket.unlocked,
		})),
	);
</script>

<div class="space-y-5">
	<div class="space-y-3">
		<div>
			<div class="mb-2 flex items-center justify-between text-sm">
				<span class="text-surface-300">Rarity mix</span>
				<span class="text-surface-300 tabular-nums">{totalCount} total</span>
			</div>
			<div class="bg-surface-900 flex h-5 overflow-hidden rounded border border-surface-700">
				{#each buckets.filter((bucket: Bucket) => bucket.total > 0) as bucket (bucket.key)}
					<div
						style:width={`${(bucket.total / totalCount) * 100}%`}
						style:background-color={colorFor(bucket.key)}
						title={`${bucket.label}: ${bucket.total}`}
					></div>
				{/each}
			</div>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between text-sm">
				<span class="text-surface-300">Unlock progress by rarity</span>
				<span class="text-surface-300 tabular-nums">{unlockedPercent.toFixed(1)}%</span>
			</div>
			<div class="bg-surface-900 flex h-5 overflow-hidden rounded border border-surface-700">
				{#each progressBuckets.filter((bucket: Bucket & { progressValue: number }) => bucket.progressValue > 0) as bucket (bucket.key)}
					<div
						style:width={`${(bucket.progressValue / totalCount) * 100}%`}
						style:background-color={colorFor(bucket.key, bucket.key === "locked" ? "base" : "dark")}
						title={`${bucket.label}: ${bucket.progressValue}`}
					></div>
				{/each}
			</div>
		</div>
	</div>

	<div class="grid gap-2 text-sm sm:grid-cols-2">
		{#each buckets as bucket (bucket.key)}
			<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded bg-surface-900/60 px-3 py-2">
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="size-2.5 shrink-0 rounded-full"
						style:background-color={colorFor(bucket.key)}
						aria-hidden="true"
					></span>
					<span class="truncate">{bucket.label}</span>
				</div>
				<div class="text-right tabular-nums">
					<span class="text-surface-100">{bucket.total}</span>
					<span class="text-surface-500 mx-1">/</span>
					<span class="text-surface-300">{bucket.unlocked}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
