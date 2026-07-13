<script lang="ts">
	import type { SteamUserAchievement } from "@project/lib";
	import { m } from "$lib/paraglide/messages";
	import { localizeHref } from "$lib/paraglide/runtime";

	type FriendSummary = {
		totalCount: number;
		unlockedCount: number;
		achievement: SteamUserAchievement | undefined;
	};

	type Row = FriendSummary & {
		completion: number;
		friend: NonNullable<SteamUserAchievement["user"]>;
	};

	let { summaries }: { summaries: FriendSummary[] } = $props();

	let rows = $derived.by<Row[]>(() =>
		summaries
			.flatMap((summary) => {
				const friend = summary.achievement?.user;
				if (!friend) return [];
				const completion =
					summary.totalCount > 0
						? Math.min(100, Math.max(0, (summary.unlockedCount / summary.totalCount) * 100))
						: 0;
				return [{ ...summary, completion, friend }];
			})
			.toSorted((a, b) => b.completion - a.completion || a.friend.displayName.localeCompare(b.friend.displayName))
			.slice(0, 12),
	);
</script>

{#if rows.length > 1}
	<figure class="card secondary mb-6 space-y-4 p-4" aria-label={m["friend.achievementProgress"]()}>
		<figcaption class="flex flex-wrap items-baseline justify-between gap-2">
			<h3 class="font-semibold">{m["friend.achievementProgress"]()}</h3>
			<span class="text-surface-400 text-xs">{m["chart.unlockedAchievements.label"]()}</span>
		</figcaption>

		<div
			class="grid grid-cols-[minmax(7rem,9rem)_minmax(4rem,1fr)_auto] items-end gap-2 px-2 text-xs sm:grid-cols-[minmax(8rem,12rem)_minmax(7rem,1fr)_auto] sm:gap-3"
		>
			<div></div>
			<div class="text-surface-500 flex justify-between tabular-nums" aria-hidden="true">
				<span>0%</span>
				<span>50%</span>
				<span>100%</span>
			</div>
			<div class="min-w-19 sm:min-w-22"></div>
		</div>

		<div class="space-y-1.5">
			{#each rows as row (row.friend.id)}
				<div
					class="grid grid-cols-[minmax(7rem,9rem)_minmax(4rem,1fr)_auto] items-center gap-2 rounded px-2 py-2 text-sm sm:grid-cols-[minmax(8rem,12rem)_minmax(7rem,1fr)_auto] sm:gap-3"
				>
					<a
						href={localizeHref(`/user/${row.friend.id}`)}
						class="flex min-w-0 items-center gap-2 hover:underline"
						title={row.friend.displayName}
					>
						<img
							src={row.friend.avatar || "/placeholder.svg"}
							alt=""
							width="28"
							height="28"
							class="border-surface-600 bg-surface-800 size-7 shrink-0 rounded-full border"
						>
						<span class="truncate">{row.friend.displayName}</span>
					</a>
					<div class="bg-surface-700 relative h-0.5" aria-hidden="true">
						<div class="bg-surface-600 absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2"></div>
						<div class="bg-primary-500 absolute inset-y-0 left-0" style:width={`${row.completion}%`}></div>
						<div
							class="bg-primary-500 ring-surface-900 absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
							style:left={`${row.completion}%`}
						></div>
					</div>
					<div class="min-w-19 text-right text-xs tabular-nums sm:min-w-22">
						<span class="text-surface-100 font-medium">{row.unlockedCount}/{row.totalCount}</span>
						<span class="text-surface-400 ml-1">{row.completion.toFixed(0)}%</span>
					</div>
				</div>
			{/each}
		</div>
	</figure>
{/if}
