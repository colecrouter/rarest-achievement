<script lang="ts">
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import Transition from "$lib/Transition.svelte";
    import Card from "./_card.svelte";
    import Placeholder from "./_placeholder.svelte";
    import type { SteamAppAchievement, SteamUserAchievement } from "lib";

    interface Props {
        achievements: MaybePromise<
            Array<SteamUserAchievement | SteamAppAchievement>
        >;
        secondary?: boolean;
    }
    let { achievements, secondary = false }: Props = $props();

    const grid =
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
</script>

<TransitionWrapper>
    {#await achievements}
        <div class={grid}>
            {#each new Array(6) as _}
                <Placeholder {secondary} />
            {/each}
        </div>
    {:then achievements}
        <Transition>
            <div class={grid}>
                {#if !achievements || achievements.length === 0}
                    <!-- No achievements available -->
                    <div
                        class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center"
                    >
                        <h3 class="mb-2 text-xl font-bold">
                            No achievements found
                        </h3>
                        <p class="mx-auto max-w-md text-gray-400">
                            No achievements available.
                        </p>
                    </div>
                {:else}
                    {#each achievements as achievement}
                        <Card {achievement} {secondary} />
                    {/each}
                {/if}
            </div>
        </Transition>
    {/await}
</TransitionWrapper>
