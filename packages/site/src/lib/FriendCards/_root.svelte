<script lang="ts">
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import TrophyIcon from "@lucide/svelte/icons/trophy";
    import type { SteamOwnedGame, SteamUser, SteamUserAchievement } from "lib";
    import FriendCard from "./_card.svelte";
    import Placeholder from "./_placeholder.svelte";

    interface Props {
        data: MaybePromise<
            | {
                  friend: SteamUser;
                  owned: SteamOwnedGame;
                  achievements: Array<SteamUserAchievement>;
                  achievement?: SteamUserAchievement;
              }[]
            | null
        >;
        secondary?: boolean;
    }

    let { data, secondary }: Props = $props();

    const grid = "grid w-full md:grid-cols-3 gap-4";
</script>

<div class="space-y-4 {secondary && 'card min-h-[250px] p-4'}">
    <TransitionWrapper>
        {#await data}
            <div class={grid}>
                {#each new Array(6)}
                    <Placeholder />
                {/each}
            </div>
        {:then friends}
            <Transition>
                {#if friends === null}
                    <form
                        action="/?/login"
                        method="post"
                        class="flex flex-col items-center justify-center py-12"
                    >
                        <h3 class="mb-2 text-xl font-bold">
                            Sign in to see friends
                        </h3>
                        <p class="mb-6 max-w-md text-gray-400">
                            Sign in to see which of your friends have unlocked
                            this achievement.
                        </p>
                        <button class="btn preset-filled-primary-500 px-4 py-2">
                            Sign In
                        </button>
                    </form>
                {:else if friends.length === 0}
                    <div
                        class="mb-4 flex h-[200px] flex-col items-center justify-center gap-2"
                    >
                        <TrophyIcon class="h-32 w-32 text-gray-400" />
                        <div class="text-sm text-gray-400">
                            No friends have unlocked this achievement yet.
                        </div>
                    </div>
                {:else}
                    <div class={grid}>
                        {#each friends as { achievements, owned, friend, achievement }}
                            <FriendCard
                                {achievements}
                                {achievement}
                                {owned}
                                {friend}
                                {secondary}
                            />
                        {/each}
                    </div>
                {/if}
            </Transition>
        {/await}
    </TransitionWrapper>
</div>
