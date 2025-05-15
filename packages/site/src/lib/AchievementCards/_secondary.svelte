<script lang="ts">
    // biome-ignore lint/style/useImportType: <explanation>
    import {
        type SteamAppAchievement,
        SteamUserAchievement,
    } from "@project/lib/models";
    import Badge from "./_badge.svelte";

    export let achievement: SteamUserAchievement | SteamAppAchievement;

    const size = 36;

    const imgClass = "border-surface-300 bg-surface-900 rounded border";
</script>

<a
    href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
    class="card secondary flex items-center justify-between gap-3 p-2"
>
    <div class="icon-container">
        {#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
            <img
                src={achievement.iconLocked}
                alt={achievement.name}
                width={size}
                height={size}
                class={imgClass}
            />
            <img
                src={achievement.iconUnlocked}
                alt={achievement.name}
                width={size}
                height={size}
                class={`unlocked ${imgClass}`}
            />
        {:else}
            <img
                src={achievement.icon}
                alt={achievement.name}
                width={size}
                height={size}
                class={imgClass}
            />
        {/if}
    </div>
    <div class="w-full truncate text-left text-sm">
        <h4>
            {achievement.name}
        </h4>
        {#if achievement instanceof SteamUserAchievement}
            <div class="text-surface-300 mt-0.5 text-xs">
                {#if achievement.unlocked}
                    Unlocked: {achievement.unlocked.toLocaleDateString(
                        undefined,
                        {
                            dateStyle: "short",
                        },
                    )}
                {:else}
                    Locked
                {/if}
            </div>
        {/if}
    </div>
    <Badge {achievement} />
</a>

<style>
    /* ...existing styles similar to primary... */
    .icon-container {
        position: relative;
        transition: transform 0.5s ease-in-out;
    }
    .icon-container img {
        max-width: initial;
        height: initial;
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
