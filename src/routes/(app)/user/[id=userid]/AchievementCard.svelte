<script lang="ts">
    import { getRarity } from "$lib/rarity";
    import type { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

    interface Props {
        achievement: SteamUserAchievement | SteamAppAchievement;
    }

    let { achievement }: Props = $props();

    let rarity = $derived(getRarity(achievement.globalPercentage));
</script>

<div class="card">
    <article class="flex h-full flex-col justify-between p-0">
        <div class="flex items-start gap-4 p-4">
            <div class="relative flex-shrink-0">
                {#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
                    <div class="icon-container">
                        <!-- Locked icon -->
                        <img
                            src={achievement.iconLocked}
                            alt={achievement.name}
                            width="64"
                            height="64"
                            class="rounded-md border border-gray-700 bg-gray-900"
                        />
                        <!-- Unlocked icon shown on hover -->
                        <img
                            src={achievement.iconUnlocked}
                            alt={achievement.name}
                            width="64"
                            height="64"
                            class="unlocked rounded-md border border-gray-700 bg-gray-900"
                        />
                    </div>
                {:else}
                    <div class="icon-container">
                        <!-- Single icon wrapped in container for universal effect -->
                        <img
                            src={achievement.icon}
                            alt={achievement.name}
                            width="64"
                            height="64"
                            class="rounded-md border border-gray-700 bg-gray-900"
                        />
                    </div>
                {/if}
                <div
                    class="absolute -right-2 -bottom-2 rounded-full bg-{rarity} px-1.5 py-0.5 text-xs font-bold text-gray-900"
                >
                    {achievement.globalPercentage}%
                </div>
            </div>
            <div>
                <h3 class="text-sm font-bold">
                    <a
                        class="hover:underline"
                        href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
                    >
                        {achievement.name}
                    </a>
                </h3>
                <p class="mb-1 text-xs text-gray-400">
                    <a
                        class="hover:underline"
                        href={`/game/${achievement.app.id}`}
                    >
                        {achievement.app.name}
                    </a>
                </p>
                <p class="line-clamp-2 text-xs text-gray-300">
                    {achievement.description}
                </p>
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

<style>
    .icon-container {
        position: relative;
        width: 64px;
        height: 64px;
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
