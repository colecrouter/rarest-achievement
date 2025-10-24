<script lang="ts" module>
	const barColor = (ratio: number): Rarity => {
		if (ratio >= 1) return "ultra-rare";
		if (ratio >= 0.75) return "rare";
		if (ratio >= 0.5) return "uncommon";
		return "common";
	};
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { localizeHref } from "$lib/paraglide/runtime";
	import type { Rarity } from "$lib/rarity";
	import { SteamUserAchievement, SteamUserStatus } from "@project/lib";
	import { Progress } from "@skeletonlabs/skeleton-svelte";

	interface Props {
		totalCount: number;
		unlockedCount: number;
		achievement: SteamUserAchievement | undefined;
		secondary?: boolean;
	}

	let { totalCount, unlockedCount, achievement, secondary }: Props = $props();

	let friend = $derived(achievement?.user);
	let completion = $derived((unlockedCount / totalCount) * 100);
	let color = $derived(barColor(completion / 100));

	// DO NOT USE `owned` or `achievement` because it can be undefined
	let playTime = $derived(
		friend?.ownedApps.find((g) => g.id === achievement?.app.id)?.playtime ??
			0,
	);
</script>

{#if friend}
	<div class="card {secondary && 'secondary'} p-4">
		<div class="mb-4 flex items-center gap-3">
			<a class="relative" href={localizeHref(`/user/${friend.id}`)}>
				<img
					src={friend.avatar || "/placeholder.svg"}
					alt={friend.displayName}
					width="48"
					height="48"
					class="card rounded-full !border-2"
				/>
				<div
					class="card absolute right-0 bottom-0 h-3 w-3 rounded-full !border-2 {friend.status !==
					SteamUserStatus.Offline
						? '!bg-green-500'
						: '!bg-gray-500'}"
				></div>
			</a>
			<div>
				<a
					class="font-medium hover:underline"
					href={localizeHref(`/user/${friend.id}`)}
					data-testid="friend-card-name-link"
				>
					{friend.displayName}
				</a>
				<div class="text-surface-300 text-xs">
					{#if achievement}
						{#if achievement.unlocked}
							{m["status.unlocked"]()}: {achievement.unlocked.toLocaleDateString()}
						{:else}
							{m["status.locked"]()}
						{/if}
					{:else}
						{m["friend.hoursPlayed"]({
							hours: ((playTime ?? 0) / 60).toFixed(1),
						})}
					{/if}
				</div>
			</div>
		</div>
		<div class="mb-3">
			{#if friend.private}
				<div class="text-surface-800">
					{m["profile.private"]()}
				</div>
			{:else}
				<div class="mb-1 flex items-center justify-between">
					<div class="text-surface-300 text-xs">
						{m["friend.achievementProgress"]()}
					</div>
					<div class="text-xs font-medium">
						{completion.toFixed(0)}%
					</div>
				</div>
				<Progress
					value={completion}
					max={100}
					meterBg={`bg-${color}`}
					trackBg={"bg-surface-700"}
				></Progress>
			{/if}
		</div>
		<div class="text-surface-500 flex items-center justify-between text-xs">
			<span> </span>
		</div>
	</div>
{/if}
