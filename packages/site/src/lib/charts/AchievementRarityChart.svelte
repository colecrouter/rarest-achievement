<script lang="ts">
	import { Bar, BarChart } from "layerchart/svg";
	import { goto } from "$app/navigation";
	import { localizeHref } from "$lib/paraglide/runtime";
	import { getRarity, type Rarity } from "$lib/rarity";

	type AchievementRow = {
		id: string;
		name: string;
		globalPercentage: number;
	};

	type Row = {
		id: string;
		name: string;
		label: string;
		rarity: number;
		rarityKey: Rarity;
		isCurrent: boolean;
	};

	let { achievements, currentAchievementId, appId } = $props<{
		achievements: AchievementRow[];
		currentAchievementId: string;
		appId: number;
	}>();

	const shortLabel = (value: string) => (value.length > 26 ? `${value.slice(0, 23)}...` : value);
	const colorFor = (row: Row) =>
		`var(--color-${row.rarityKey}${row.isCurrent ? "-light" : "-dark"})`;

	let rows: Row[] = $derived(
		achievements
			.toSorted((a: AchievementRow, b: AchievementRow) => a.globalPercentage - b.globalPercentage)
			.map((achievement: AchievementRow) => ({
				id: achievement.id,
				name: achievement.name,
				label: shortLabel(achievement.name),
				rarity: achievement.globalPercentage,
				rarityKey: getRarity(achievement.globalPercentage),
				isCurrent: achievement.id === currentAchievementId,
			})),
	);

	let currentRank = $derived(rows.findIndex((row: Row) => row.isCurrent) + 1);
	let chartHeight = $derived(Math.max(280, rows.length * 28 + 36));

	function openAchievement(id: string) {
		goto(localizeHref(`/game/${appId}/achievement/${id}`), {
			keepFocus: true,
		});
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
		<div class="text-surface-300">
			Ranked <span class="text-surface-100 tabular-nums">{currentRank}</span> of
			<span class="text-surface-100 tabular-nums">{rows.length}</span>
		</div>
		<div class="flex items-center gap-2 text-surface-300">
			<span class="bg-primary-500 inline-block h-2.5 w-5 rounded-full"></span>
			<span>Selected achievement</span>
		</div>
	</div>

	<div class="border-surface-700 max-h-[480px] overflow-auto rounded border bg-surface-900/40 p-3">
		<div
			class="grid min-w-[680px] grid-cols-[minmax(9rem,14rem)_minmax(28rem,1fr)] gap-3"
			style:height={`${chartHeight}px`}
		>
			<div class="pt-2 pb-7">
				{#each rows as row (row.id)}
					<button
						type="button"
						class="hover:text-surface-50 flex h-7 w-full items-center justify-end truncate pr-1 text-right text-sm text-surface-200"
						title={row.name}
						onclick={() => openAchievement(row.id)}
					>
						<span class:font-bold={row.isCurrent}>{row.label}</span>
					</button>
				{/each}
			</div>

			<BarChart
				data={rows}
				x="rarity"
				y="label"
				orientation="horizontal"
				xDomain={[0, 100]}
				yDomain={rows.map((row: Row) => row.label)}
				bandPadding={0.22}
				padding={{ top: 8, right: 48, bottom: 28, left: 0 }}
				axis="x"
				grid={true}
				rule={false}
				highlight={false}
				tooltipContext={false}
			>
				{#snippet marks()}
					{#each rows as row (row.id)}
						<Bar
							data={row}
							radius={4}
							rounded="right"
							fill={row.isCurrent ? "var(--color-primary-500)" : colorFor(row)}
							stroke={row.isCurrent ? "var(--color-primary-300)" : "transparent"}
							strokeWidth={row.isCurrent ? 1 : 0}
							opacity={row.isCurrent ? 1 : 0.78}
							onclick={() => openAchievement(row.id)}
							class="cursor-pointer transition-opacity hover:opacity-100"
						/>
					{/each}
				{/snippet}
			</BarChart>
		</div>
	</div>
</div>
