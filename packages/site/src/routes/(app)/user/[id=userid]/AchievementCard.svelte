<script lang="ts">
    import { getLocale } from "$lib/paraglide/runtime";
    import { getRarity } from "$lib/rarity";
    import { getSortManager } from "$lib/sortManager.svelte";
    import type { SteamAppAchievement } from "@project/lib";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "@project/lib";

    interface Props {
        achievement: SteamUserAchievement | SteamAppAchievement;
        secondary?: boolean;
    }

    let { achievement, secondary }: Props = $props();

    let rarity = $derived(getRarity(achievement.globalPercentage));

    const sortManager = getSortManager();

    const intl = new Intl.NumberFormat(getLocale(), {
        style: "decimal",
        notation: "compact",
        maximumFractionDigits: 0,
    });

    let size = $derived(secondary ? 36 : 64);
</script>

{#snippet icon()}
    <div>
        <a
            href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
            class="content"
        >
            {#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
                <div class="icon-container">
                    <!-- Locked icon -->
                    <img
                        src={achievement.iconLocked}
                        alt={achievement.name}
                        width={size}
                        height={size}
                        class="rounded-md border border-gray-600 bg-gray-900"
                    />
                    <!-- Unlocked icon shown on hover -->
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
                    <!-- Single icon wrapped in container for universal effect -->
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
    </div>
{/snippet}

{#snippet badge()}
    <div
        class="rounded-full bg-{rarity} px-1.5 py-0.5 text-xs font-bold text-gray-900"
    >
        {#if sortManager.method === "globalPercentage"}
            {#if achievement.globalPercentage < 0.1}
                &lt;0.1%
            {:else}
                {achievement.globalPercentage}%
            {/if}
        {:else if sortManager.method === "globalCount"}
            <!-- {achievement.globalCount} -->
            {intl.format(achievement.globalCount)}
        {/if}
    </div>
{/snippet}

{#if secondary}
    <div
        class="card flex items-center gap-3 !bg-gray-900/50 p-2 hover:bg-gray-700/30"
    >
        {@render icon()}
        <a
            href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
            class="min-w-0 flex-1"
        >
            <div class="flex items-center justify-between">
                <h4 class="truncate text-sm font-medium">
                    {achievement.name}
                </h4>
                <div
                    class="rounded-full bg-{rarity} px-1.5 py-0.5 text-xs font-medium text-gray-950"
                >
                    {achievement.globalPercentage}%
                </div>
            </div>
            <div class="mt-0.5 text-xs text-gray-400">
                {#if achievement instanceof SteamUserAchievement}
                    {#if achievement.unlocked}
                        Unlocked:
                        {achievement.unlocked.toLocaleDateString(undefined, {
                            dateStyle: "short",
                        })}
                    {:else}
                        Locked
                    {/if}
                {/if}
            </div>
        </a>
    </div>
{:else}
    <div class="card {secondary ? 'secondary' : ''}">
        <article class="flex h-full flex-col justify-between p-0">
            <div class="flex items-start gap-4 p-4">
                <div class="relative flex-shrink-0">
                    {@render icon()}

                    <!-- Badge -->
                    {#if !secondary}
                        <div class="absolute -right-2 -bottom-2">
                            {@render badge()}
                        </div>
                    {/if}
                </div>
                <div>
                    <!-- Achievement name -->
                    <h3 class="line-clamp-2 text-sm font-bold">
                        <a
                            class="hover:underline"
                            href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
                        >
                            {achievement.name}
                        </a>
                    </h3>

                    <!-- Game name -->
                    {#if !secondary}
                        <p class="mb-1 text-xs text-gray-400">
                            <a
                                class="hover:underline"
                                href={`/game/${achievement.app.id}`}
                            >
                                {achievement.app.name}
                            </a>
                        </p>
                        {#if achievement.hidden}
                            <p class="text-xs font-bold text-gray-400 italic">
                                Hidden
                            </p>
                        {:else}
                            <p class="line-clamp-2 text-xs text-gray-300">
                                {achievement.description}
                            </p>
                        {/if}
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
                        href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
                        class="text-amber-500 hover:text-amber-400">Details</a
                    >
                {/if}
            </div>
        </article>
    </div>
{/if}

<style>
    .icon-container {
        position: relative;
        overflow: hidden; /* ensure pseudo-element is clipped */
        transition: transform 0.5s ease-in-out;
        border-radius: 0.375rem;
    }
    .icon-container img {
        display: block;
    }
    .icon-container img.unlocked {
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transform: scale(1);
        transition: opacity 0.5s ease-in-out;
    }
    .icon-container:hover {
        transform: scale(1.1);
    }
    .icon-container:hover img.unlocked {
        opacity: 1;
        /* removed individual scaling */
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
