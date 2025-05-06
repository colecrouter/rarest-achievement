<script lang="ts">
    import { getSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import { getLocale } from "$lib/paraglide/runtime";
    import { getRarity } from "$lib/rarity";
    import Lock from "@lucide/svelte/icons/lock";
    import type { SteamAppAchievement } from "@project/lib";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "@project/lib";

    export let achievement: SteamUserAchievement | SteamAppAchievement;

    const rarity = getRarity(achievement.globalPercentage);
    const sortManager = getSortManager();
    const intl = new Intl.NumberFormat(getLocale(), {
        style: "decimal",
        notation: "compact",
        maximumFractionDigits: 0,
    });
    const size = 64;
</script>

<div class="card">
    <article class="flex h-full flex-col justify-between p-0">
        <div class="flex items-start gap-4 p-4">
            <div class="relative flex-shrink-0">
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
                <!-- badge snippet -->
                <div class="absolute -right-2 -bottom-2">
                    <div
                        class="rounded-full bg-{rarity} px-1.5 py-0.5 text-xs font-bold text-gray-900"
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
                            {:else}
                                {intl.format(achievement.globalCount)}
                            {/if}
                        {:else if sortManager.method === "unlocked" && achievement instanceof SteamUserAchievement}
                            <!-- show days elapsed since -->
                            {#if achievement.unlocked}
                                {Math.floor(
                                    (Date.now() -
                                        achievement.unlocked.getTime()) /
                                        (1000 * 60 * 60 * 24),
                                )}d
                            {:else}
                                <Lock class="m-[0.2em] h-[1em] w-auto" />
                                <span hidden> Locked </span>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
            <div>
                <!-- Achievement name -->
                <h3 class="line-clamp-2 text-sm font-bold">
                    <a
                        class="hover:underline"
                        href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
                    >
                        {achievement.name}
                    </a>
                </h3>
                <!-- Game name & description -->
                <p class="mb-1 text-xs text-gray-400">
                    <a
                        class="hover:underline"
                        href={`/game/${achievement.app.id}`}
                    >
                        {achievement.app.name}
                    </a>
                </p>
                {#if achievement.hidden}
                    <p class="text-xs font-bold text-gray-400 italic">Hidden</p>
                {:else}
                    <p class="line-clamp-2 text-xs text-gray-300">
                        {achievement.description}
                    </p>
                {/if}
            </div>
        </div>
        <div
            class="flex items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400"
        >
            {#if achievement instanceof SteamUserAchievement}
                <span>
                    {#if achievement.unlocked}
                        Unlocked: {achievement.unlocked.toLocaleDateString()}
                    {:else}
                        Locked
                    {/if}
                </span>
                <a
                    href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
                    class="text-primary-500 hover:text-primary-400"
                >
                    Details
                </a>
            {/if}
        </div>
    </article>
</div>

<style>
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
    .icon-container:hover::after {
        content: "";
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            120deg,
            transparent,
            rgba(255, 255, 255, 0.6),
            transparent
        );
        transform: skewX(-20deg);
        animation: shine 0.8s forwards;
        pointer-events: none;
    }
    @keyframes shine {
        to {
            left: 100%;
        }
    }
</style>
