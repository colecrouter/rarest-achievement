<script lang="ts">
    import type { SteamAppAchievement } from "@project/lib";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "@project/lib";
    import Badge from "./_badge.svelte";

    export let achievement: SteamUserAchievement | SteamAppAchievement;

    const size = 64;

    const imgClass = "border-surface-300 bg-surface-900 rounded border";
</script>

<div class="card">
    <article class="flex h-full flex-col justify-between">
        <!-- Main section -->
        <div class="flex items-start gap-4 p-4">
            <!-- icon snippet -->
            <a
                href={`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`}
                class="relative"
            >
                {#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
                    <div class="icon-container">
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
                    </div>
                {:else}
                    <div class="icon-container">
                        <img
                            src={achievement.icon}
                            alt={achievement.name}
                            width={size}
                            height={size}
                            class={imgClass}
                        />
                    </div>
                {/if}
                <!-- badge snippet -->
                <div class="absolute -right-2 -bottom-2">
                    <Badge {achievement} />
                </div>
            </a>
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
                <p class="text-surface-300 mb-1 text-xs">
                    <a
                        class="hover:underline"
                        href={`/game/${achievement.app.id}`}
                    >
                        {achievement.app.name}
                    </a>
                </p>
                {#if achievement.hidden}
                    <p class="text-surface-300 text-xs font-bold italic">
                        Hidden
                    </p>
                {:else}
                    <p class="text-surface-100 line-clamp-2 text-xs">
                        {achievement.description}
                    </p>
                {/if}
            </div>
        </div>

        <!-- Footer section -->
        <div
            class="text-surface-300 bg-surface-900 flex items-center justify-between px-4 py-2 text-xs"
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
        transition: transform 0.5s ease-in-out;
        width: 64px;
        overflow: hidden;
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
