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
                class="card rounded-full !border-2"
            />
            <div
                class="card absolute right-0 bottom-0 h-3 w-3 rounded-full !border-2 {friend.status !==
                SteamUserStatus.Offline
                    ? '!bg-green-500'
                    : '!bg-gray-500'}"
            ></div>
        </a>
        <div>
            <a class="font-medium hover:underline" href="/user/{friend.id}">
                {friend.displayName}
            </a>
            <div class="text-surface-300 text-xs">
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
        {#if friend.private || !achievements.length}
            <div class=" text-surface-800">This profile is private.</div>
        {:else}
            <div class="mb-1 flex items-center justify-between">
                <div class="text-surface-300 text-xs">Achievement Progress</div>
                <div class="text-xs font-medium">
                    {completion.toFixed(0)}%
                </div>
            </div>
            <Progress
                value={completion}
                max={100}
                meterBg={`bg-${color}`}
                trackBg={"bg-surface-700"}
            ></Progress>
        {/if}
    </div>
    <div class="text-surface-500 flex items-center justify-between text-xs">
        <span>
            <!-- {friend.achievements} / {app
                                            .achievementStats.total} achievements -->
        </span>
    </div>
</div>
