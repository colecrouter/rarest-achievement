<script lang="ts" module>
    const numberFormat = new Intl.NumberFormat(getLocale(), {
        style: "decimal",
        notation: "compact",
        maximumFractionDigits: 0,
    });

    // @ts-ignore https://github.com/microsoft/TypeScript/issues/60608
    // Format Dates like "1d"
    const dateFormat = new Intl.DurationFormat(getLocale(), {
        style: "narrow",
    });
</script>

<script lang="ts">
    import { getSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import { m } from "$lib/paraglide/messages.js";
    import { getLocale } from "$lib/paraglide/runtime";
    import { getRarity } from "$lib/rarity";
    import Lock from "@lucide/svelte/icons/lock";
    import type { SteamAppAchievement } from "@project/lib";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "@project/lib";

    interface Props {
        achievement: SteamUserAchievement | SteamAppAchievement;
    }
    let { achievement }: Props = $props();

    const sortManager = getSortManager();
    const rarity = $derived(getRarity(achievement.globalPercentage));
</script>

<div
    class="badge bg-{rarity} text-surface-900 heading-line-height px-1.5 py-0 text-xs font-bold"
>
    {#if sortManager.method === "percentage"}
        {#if achievement.globalPercentage < 0.1}
            &lt;0.1%
        {:else}
            {achievement.globalPercentage}%
        {/if}
    {:else if sortManager.method === "count"}
        {#if achievement.globalCount === null}
            ???
        {:else if achievement.app.estimatedPlayers && achievement.globalPercentage < 0.1}
            &lt;{numberFormat.format(achievement.app.estimatedPlayers * 0.001)}
        {:else}
            {numberFormat.format(achievement.globalCount)}
        {/if}
    {:else if sortManager.method === "unlocked" && achievement instanceof SteamUserAchievement}
        <!-- show days elapsed since -->
        {#if achievement.unlocked}
            {@const daysSinceUnlocked = Math.floor(
                (Date.now() - achievement.unlocked.getTime()) /
                    (1000 * 60 * 60 * 24),
            )}
            {@const integer = dateFormat.format({ days: daysSinceUnlocked })}
            <!-- {Math.floor(
                (Date.now() - achievement.unlocked.getTime()) /
                    (1000 * 60 * 60 * 24),
            )}d -->
            {integer}
        {:else}
            <Lock class="m-[0.2em] h-[1em] w-auto" />
            <span hidden>{m.statusLocked()}</span>
        {/if}
    {/if}
</div>
