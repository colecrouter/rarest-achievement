<script lang="ts" module>
    const barColor = (ratio: number): Rarity => {
        if (ratio >= 1) return "ultra-rare";
        if (ratio >= 0.75) return "rare";
        if (ratio >= 0.5) return "uncommon";
        return "common";
    };
</script>

<script lang="ts">
    import type { Rarity } from "$lib/rarity";
    import {
        SteamUserAchievement,
        SteamUserStatus,
        type SteamOwnedGame,
        type SteamUser,
    } from "@project/lib";
    import { Progress } from "@skeletonlabs/skeleton-svelte";

    interface Props {
        friend: SteamUser;
        owned: SteamOwnedGame;
        achievements: Array<SteamUserAchievement>;
        achievement?: SteamUserAchievement;
        secondary?: boolean;
    }

    let { achievements, friend, achievement, owned, secondary }: Props =
        $props();

    let unlockedCount = $derived(
        [...achievements.values()]
            .filter((a) => a instanceof SteamUserAchievement)
            .filter((achievement) => achievement.unlocked).length,
    );
    let totalCount = $derived(achievements.length);

    let completion = $derived((unlockedCount / totalCount) * 100);
    let color = $derived(barColor(completion / 100));
</script>

<div class="card {secondary && 'secondary'} p-4">
    <div class="mb-4 flex items-center gap-3">
        <a class="relative" href="/user/{friend.id}">
            <img
                src={friend.avatar || "/placeholder.svg"}
                alt={friend.displayName}
                width="48"
                height="48"
                class="rounded-full border border-gray-700"
            />
            <div
                class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-800 {friend.status !==
                SteamUserStatus.Offline
                    ? 'bg-green-500'
                    : 'bg-gray-500'}"
            ></div>
        </a>
        <div>
            <a class="font-medium hover:underline" href="/user/{friend.id}">
                {friend.displayName}
            </a>
            <div class="text-xs text-gray-400">
                {#if achievement}
                    {#if achievement.unlocked}
                        Unlocked {achievement?.unlocked?.toLocaleDateString()}
                    {:else}
                        Locked
                    {/if}
                {:else}
                    {((owned.playtime ?? 0) / 60).toFixed(1)} hours played
                {/if}
            </div>
        </div>
    </div>
    <div class="mb-3">
        <div class="mb-1 flex items-center justify-between">
            <div class="text-xs text-gray-400">Achievement Progress</div>
            <div class="text-xs font-medium">
                {completion.toFixed(0)}%
            </div>
        </div>
        <!-- <div class="h-1.5 rounded bg-gray-700">
                                <div
                                    class="h-full rounded-full {completion ===
                                    100
                                        ? 'bg-green-500'
                                        : completion > 75
                                          ? 'bg-amber-500'
                                          : 'bg-blue-500'}"
                                    style="width: {completion}%"
                                ></div>
                            </div> -->
        <Progress value={completion} max={100} meterBg={`bg-${color}`}
        ></Progress>
    </div>
    <div class="flex items-center justify-between text-xs text-gray-400">
        <span>
            <!-- {friend.achievements} / {app
                                        .achievementStats.total} achievements -->
        </span>
        <!-- <button
                                class="h-7 px-2 text-gray-400 hover:text-gray-100"
                            >
                                Compare
                            </button> -->
    </div>
</div>
