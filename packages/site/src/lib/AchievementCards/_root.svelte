<script lang="ts">
    import { getSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import Transition from "$lib/Transition.svelte";
    import type { SteamAppAchievement, SteamUserAchievement } from "lib";
    import { flip } from "svelte/animate";
    import { quintOut } from "svelte/easing";
    import { crossfade } from "svelte/transition";
    import Card from "./_card.svelte";
    import Placeholder from "./_placeholder.svelte";

    interface Props {
        achievements: MaybePromise<
            Array<SteamUserAchievement | SteamAppAchievement>
        >;
        secondary?: boolean;
    }
    let { achievements, secondary = false }: Props = $props();

    const grid =
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

    const [send, receive] = crossfade({
        duration: (d) => Math.sqrt(d * 200),

        fallback(node) {
            const style = getComputedStyle(node);
            const transform = style.transform === "none" ? "" : style.transform;

            return {
                duration: 300,
                easing: quintOut,
                css: (t) => `
				transform: ${transform} translateY(${(1 - t) * 100}px);
				opacity: ${t}
			`,
            };
        },
    });

    const sortManager = getSortManager();
</script>

{#await achievements}
    <div class={grid}>
        {#each new Array(6) as _}
            <Placeholder {secondary} />
        {/each}
    </div>
{:then achievements}
    {@const sortedAchievements = sortManager.sort(achievements)}
    <div class={grid}>
        {#if !sortedAchievements || sortedAchievements.length === 0}
            <Transition>
                <!-- No achievements available -->
                <div class="card p-8 text-center">
                    <h3 class="mb-2 text-xl font-bold">
                        No achievements found
                    </h3>
                    <p class="text-surface-300 mx-auto max-w-md">
                        No achievements available.
                    </p>
                </div>
            </Transition>
        {:else}
            {#each sortedAchievements.slice(0, 32) as achievement (achievement.id + achievement.app.id)}
                <div
                    in:receive={{ key: achievement.id + achievement.app.id }}
                    out:send={{ key: achievement.id + achievement.app.id }}
                    animate:flip={{ duration: 200 }}
                >
                    <Card {achievement} {secondary} />
                </div>
            {/each}
        {/if}
    </div>
{/await}
