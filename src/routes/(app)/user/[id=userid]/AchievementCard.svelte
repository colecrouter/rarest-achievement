<script lang="ts">
    import type { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
    // biome-ignore lint/style/useImportType: <explanation>
    import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

    interface Props {
        achievement: SteamUserAchievement | SteamAppAchievement;
    }

    let { achievement }: Props = $props();
</script>

<div class="card">
    <article class="flex h-full flex-col justify-between p-0">
        <div class="flex items-start gap-3 p-4">
            <div class="relative flex-shrink-0">
                <img
                    src={achievement.icon || "/placeholder.svg"}
                    alt={achievement.name}
                    width="64"
                    height="64"
                    class="rounded-md border border-gray-700 bg-gray-900"
                />
                <div
                    class="absolute -right-2 -bottom-2 rounded-full {achievement.globalPercentage <=
                    10
                        ? 'bg-amber-500'
                        : 'bg-gray-500'} px-1.5 py-0.5 text-xs font-bold text-gray-900"
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
                <span
                    >Unlocked: {achievement.unlocked?.toLocaleDateString()}</span
                >
                <a
                    href={`/game/${achievement.app.id}/achievement/${achievement.id}`}
                    class="text-amber-500 hover:text-amber-400">Details</a
                >
            {/if}
        </div>
    </article>
</div>
