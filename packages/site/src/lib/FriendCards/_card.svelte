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
	import {
		SteamUserAchievement,
		SteamUserStatus,
		type SteamAppAchievement,
		type SteamUser,
	} from "@project/lib";
	import { Progress } from "@skeletonlabs/skeleton-svelte";

	interface Props {
		friend: SteamUser;
		allAchievements: Array<SteamUserAchievement>;
		targetAchievement?: SteamAppAchievement;
		secondary?: boolean;
	}

	let { allAchievements, friend, targetAchievement, secondary }: Props =
		$props();

	let owned = $derived(
		allAchievements
			.find((a) => a instanceof SteamUserAchievement)
			?.user?.ownedApps?.find(
				(g) => g.id === targetAchievement?.app.id,
			) ?? {
			playtime: 0,
		},
	);

	let unlockedCount = $derived(
		[...allAchievements.values()]
			.filter((a) => a instanceof SteamUserAchievement)
			.filter((achievement) => achievement.unlocked).length,
	);
	let totalCount = $derived(allAchievements.length);

	let completion = $derived((unlockedCount / totalCount) * 100);
	let color = $derived(barColor(completion / 100));
	let achievementInQuestionForFriend = $derived(
		allAchievements.find(
			(a) =>
				a instanceof SteamUserAchievement &&
				a.id === targetAchievement?.id,
		),
	);
	// DO NOT USE `owned` or `targetAchievement` because it can be undefined
	let playTime = $derived(
		allAchievements?.[0]?.user?.ownedApps?.find(
			(g) => g.id === allAchievements?.[0]?.app.id,
		)?.playtime,
	);
</script>

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
			>
				{friend.displayName}
			</a>
			<div class="text-surface-300 text-xs">
				{#if targetAchievement && achievementInQuestionForFriend}
					{#if achievementInQuestionForFriend.unlocked}
						{m.statusUnlocked()}: {achievementInQuestionForFriend.unlocked.toLocaleDateString()}
					{:else}
						{m.statusLocked()}
					{/if}
				{:else}
					{m.friendHoursPlayed({
						hours: ((playTime ?? 0) / 60).toFixed(1),
					})}
				{/if}
			</div>
		</div>
	</div>
	<div class="mb-3">
		{#if friend.private || !allAchievements.length}
			<div class="text-surface-800">
				{m.profilePrivate()}
			</div>
		{:else}
			<div class="mb-1 flex items-center justify-between">
				<div class="text-surface-300 text-xs">
					{m.friendAchievementProgress()}
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
		<span>
			<!-- {friend.achievements} / {app
                                            .achievementStats.total} achievements -->
		</span>
	</div>
</div>
