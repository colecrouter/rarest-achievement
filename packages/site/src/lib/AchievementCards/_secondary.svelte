<script lang="ts">
    import { getLocale } from "$lib/paraglide/runtime";
    import { getRarity } from "$lib/rarity";
    // biome-ignore lint/style/useImportType: <explanation>
    import {
        type SteamAppAchievement,
        SteamUserAchievement,
    } from "@project/lib/models";

    export let achievement: SteamUserAchievement | SteamAppAchievement;

    const rarity = getRarity(achievement.globalPercentage);
    const size = 36;
</script>

<div
    class="card flex items-center gap-3 !bg-gray-900/50 p-2 hover:bg-gray-700/30"
>
    <!-- icon snippet -->
    <a
        href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
        class="content"
    >
        {#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
            <div class="icon-container">
                <img
                    src={achievement.iconLocked}
                    alt={achievement.name}
                    width={size}
                    height={size}
                    class="rounded-md border border-gray-600 bg-gray-900"
                />
                <img
                    src={achievement.iconUnlocked}
                    alt={achievement.name}
                    width={size}
                    height={size}
                    class="unlocked rounded-md border border-gray-600 bg-gray-900"
                />
            </div>
        {:else}
            <div class="icon-container">
                <img
                    src={achievement.icon}
                    alt={achievement.name}
                    width={size}
                    height={size}
                    class="rounded-md border border-gray-700 bg-gray-900"
                />
            </div>
        {/if}
    </a>
    <a
        href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
        class="min-w-0 flex-1"
    >
        <div class="flex items-center justify-between">
            <h4 class="truncate text-sm font-medium">
                {achievement.name}
            </h4>
            <div
                class="rounded-full bg-{rarity} px-1.5 py-0.5 text-xs font-medium text-gray-950"
            >
                {#if achievement.globalPercentage < 0.1}
                    &lt;0.1%
                {:else}
                    {achievement.globalPercentage}%
                {/if}
            </div>
        </div>
        <div class="mt-0.5 text-xs text-gray-400">
            {#if achievement instanceof SteamUserAchievement}
                {#if achievement.unlocked}
                    Unlocked: {achievement.unlocked.toLocaleDateString(
                        undefined,
                        { dateStyle: "short" },
                    )}
                {:else}
                    Locked
                {/if}
            {/if}
        </div>
    </a>
</div>

<style>
    /* ...existing styles similar to primary... */
    .icon-container {
        position: relative;
        overflow: hidden;
        transition: transform 0.5s ease-in-out;
        border-radius: 0.375rem;
    }
    .icon-container img.unlocked {
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
    }
    .icon-container:hover {
        transform: scale(1.1);
    }
    .icon-container:hover img.unlocked {
        opacity: 1;
    }
</style>
