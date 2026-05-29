<script lang="ts">
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import { type Attempt, SteamUserAchievement } from "lib";
	import IndexError from "$lib/IndexError.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import Transition from "$lib/Transition.svelte";
	import TransitionWrapper from "$lib/TransitionWrapper.svelte";
	import FriendCard from "./_card.svelte";
	import Placeholder from "./_placeholder.svelte";

	interface Props {
		data: MaybePromise<Attempt<
			Array<{
				/** Number of total achievements for an app */
				totalCount: number;
				/** Number of achievement the user has unlocked */
				unlockedCount: number;
				/** A targeted achievement to display */
				achievement: SteamUserAchievement | undefined;
			}>
			// Null for not-logged-in state
		> | null>;
		/** Whether to use the secondary card style */
		secondary?: boolean;
		/**
		 * Whether to hide locked achievements
		 * @default false
		 */
		hideLocked?: boolean;
	}

	let { data, secondary, hideLocked }: Props = $props();

	const grid = "grid w-full md:grid-cols-3 gap-4";
</script>

<div class="space-y-4 {secondary && 'card min-h-[250px] p-4'}">
	<TransitionWrapper>
		{#await data}
			<div class={grid}>
				{#each new Array(6) as _, i (i)}
					<Placeholder />
				{/each}
			</div>
		{:then data}
			<Transition>
				{#if data === null}
					<!-- sign in form -->
					<form action="/?/login" method="post" class="flex flex-col items-center justify-center py-12">
						<h3 class="mb-2 text-xl font-bold">
							{m["friend.signIn.title"]()}
						</h3>
						<p class="text-surface-300 mb-6 max-w-md">
							{m["friend.signIn.description"]()}
						</p>
						<button
							type="submit"
							class="btn preset-filled-primary-500 px-4 py-2"
							data-testid="friend-cards-signin-button"
						>
							{m["auth.signIn"]()}
						</button>
					</form>
				{:else}
					{#if data.isError()}
						<IndexError />
					{/if}

					{#if data.hasData()}
						{@const filtered = data.data.filter(
							({ achievement: targetAchievement }) =>
								// If we are not hiding locked achievements, keep everyone
								// Keep only friends who have unlocked the target achievement
								!hideLocked ||
								targetAchievement === undefined ||
								targetAchievement.unlocked,
						)}
						{#if filtered.length === 0}
							<div class="mb-4 flex h-[200px] flex-col items-center justify-center gap-2">
								<TrophyIcon class="text-surface-300 h-32 w-32" />
								<div class="text-surface-300 text-sm">
									{m["friend.noAchievement.text"]()}
								</div>
							</div>
						{:else}
							<div class={grid}>
								{#each filtered as item}
									<FriendCard {secondary} {...item} />
								{:else}
									<!-- Fallback: either genuinely no achievements at all (handled earlier) OR
											all friends were filtered out by hideLocked + targetAchievement criteria. -->
									<div
										class="col-span-full mb-4 flex h-[200px] flex-col items-center justify-center gap-2"
									>
										<TrophyIcon class="text-surface-300 h-32 w-32" />
										<div class="text-surface-300 text-sm">
											{m["friend.noAchievement.text"]()}
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
