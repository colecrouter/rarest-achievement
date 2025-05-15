<script lang="ts">
    import { getSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
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

    const rarity = getRarity(achievement.globalPercentage);
    const sortManager = getSortManager();
    const intl = new Intl.NumberFormat(getLocale(), {
        style: "decimal",
        notation: "compact",
        maximumFractionDigits: 0,
    });
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
            &lt;{intl.format(achievement.app.estimatedPlayers * 0.001)}
        {:else}
            {intl.format(achievement.globalCount)}
        {/if}
    {:else if sortManager.method === "unlocked" && achievement instanceof SteamUserAchievement}
        <!-- show days elapsed since -->
        {#if achievement.unlocked}
            {Math.floor(
                (Date.now() - achievement.unlocked.getTime()) /
                    (1000 * 60 * 60 * 24),
            )}d
        {:else}
            <Lock class="m-[0.2em] h-[1em] w-auto" />
            <span hidden> Locked </span>
        {/if}
    {/if}
</div>
