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
                        <button class="btn preset-filled-primary-500 px-4 py-2">
                            {m.signIn()}
                        </button>
                    </form>
                {:else}
                    {#if allAchievements.isError()}
                        <IndexError />
                    {/if}

                    {#if allAchievements.hasData()}
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
                            <div class={grid}>
                                {#each grouped as [friend, allAchievements]}
                                    {#if friend}
                                        {@const userHasUnlocked =
                                            allAchievements.find(
                                                (ach) =>
                                                    ach.id ===
                                                        targetAchievement?.id &&
                                                    ach.unlocked,
                                            )}
                                        {#if hideLocked && !userHasUnlocked}{:else}
                                            <FriendCard
                                                {allAchievements}
                                                {targetAchievement}
                                                {friend}
                                                {secondary}
                                            />
                                        {/if}
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    {/if}
                {/if}
            </Transition>
        {/await}
    </TransitionWrapper>
</div>
