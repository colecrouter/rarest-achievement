<script lang="ts">
	import IndexError from "$lib/IndexError.svelte";
	import Transition from "$lib/Transition.svelte";
	import TransitionWrapper from "$lib/TransitionWrapper.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import {
		type Attempt,
		type SteamAppAchievement,
		SteamUserAchievement,
	} from "lib";
	import FriendCard from "./_card.svelte";
	import Placeholder from "./_placeholder.svelte";
	interface Props {
		/** All achievements for a user. Should include **locked** achievements. */
		allAchievements: MaybePromise<Attempt<SteamUserAchievement[]> | null>;
		/** The reference achievement */
		targetAchievement?: MaybePromise<SteamAppAchievement>;
		/** Whether to use the secondary card style */
		secondary?: boolean;
		/**
		 * Whether to hide locked achievements
		 * @default false
		 */
		hideLocked?: boolean;
	}

	let { allAchievements, targetAchievement, secondary, hideLocked }: Props =
		$props();

	const grid = "grid w-full md:grid-cols-3 gap-4";
</script>

<div class="space-y-4 {secondary && 'card min-h-[250px] p-4'}">
	<TransitionWrapper>
		{#await Promise.all([allAchievements, targetAchievement])}
			<div class={grid}>
				{#each new Array(6)}
					<Placeholder />
				{/each}
			</div>
		{:then [allAchievements, targetAchievement]}
			<Transition>
				{#if allAchievements === null}
					<!-- sign in form -->
					<form
						action="/?/login"
						method="post"
						class="flex flex-col items-center justify-center py-12"
					>
						<h3 class="mb-2 text-xl font-bold">
							{m.friendSignInTitle()}
						</h3>
						<p class="text-surface-300 mb-6 max-w-md">
							{m.friendSignInDescription()}
						</p>
						<button
							class="btn preset-filled-primary-500 px-4 py-2"
							data-testid="friend-cards-signin-button"
						>
							{m.signIn()}
						</button>
					</form>
				{:else}
					{#if allAchievements.isError()}
						<IndexError />
					{/if}

					{#if allAchievements.hasData()}
						<!-- Group all user achievement rows by the user object so we can render one card per friend.
									Using Map.groupBy avoids materializing intermediate arrays and keeps iteration cheap. -->
						{@const grouped = Map.groupBy(
							allAchievements.data,
							(item) => item.user,
						)}
						{#if allAchievements.data.length === 0}
							<div
								class="mb-4 flex h-[200px] flex-col items-center justify-center gap-2"
							>
								<TrophyIcon
									class="text-surface-300 h-32 w-32"
								/>
								<div class="text-surface-300 text-sm">
									{m.friendNoAchievementText()}
								</div>
							</div>
						{:else}
							<!-- Pre-filter the grouped entries so fallback logic can know if *all* friends were excluded. -->
							{@const filtered = [...grouped].filter(
								([friend, list]) => {
									// Ignore entries missing a user reference (should be rare / defensive)
									if (!friend) return false;
									// If we are not hiding locked achievements, keep everyone
									if (!hideLocked) return true;
									// Without a specific target achievement there's nothing to filter by
									if (!targetAchievement) return true;
									// Keep only friends who have unlocked the target achievement
									return list.some(
										(ach) =>
											ach.id === targetAchievement.id &&
											ach.unlocked,
									);
								},
							)}
							<div class={grid}>
								{#each filtered as [friend, allAchievements]}
									{#if friend}
										<FriendCard
											{allAchievements}
											{targetAchievement}
											{friend}
											{secondary}
										/>
									{/if}
								{:else}
									<!-- Fallback: either genuinely no achievements at all (handled earlier) OR
											all friends were filtered out by hideLocked + targetAchievement criteria. -->
									<div
										class="col-span-full mb-4 flex h-[200px] flex-col items-center justify-center gap-2"
									>
										<TrophyIcon
											class="text-surface-300 h-32 w-32"
										/>
										<div class="text-surface-300 text-sm">
											{m.friendNoAchievementText()}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				{/if}
			</Transition>
		{/await}
	</TransitionWrapper>
</div>
