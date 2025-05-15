<script lang="ts">
    import KeyRound from "@lucide/svelte/icons/key-round";
    import Lock from "@lucide/svelte/icons/lock";
    import SquareDashed from "@lucide/svelte/icons/square-dashed";
    import type {
        SteamAppAchievement,
        SteamUserAchievement,
    } from "@project/lib";
    import { Segment } from "@skeletonlabs/skeleton-svelte";
    import { crossfade } from "svelte/transition";
    import { getSortManager } from "./UrlParamMapper.svelte";

    interface Props {
        achievements: Array<SteamUserAchievement | SteamAppAchievement>;
    }

    let { achievements }: Props = $props();

    const sortManager = getSortManager();

    const [send, receive] = crossfade({
        duration: 200,
        // when you remove an element
        fallback(node) {
            const style = getComputedStyle(node);
            const transform = style.transform === "none" ? "" : style.transform;

            return {
                duration: 200,
                css: (t) => `transform: ${transform} opacity(${t});`,
            };
        },
    });

    const segmentRounded = "rounded-container";
    const segmentBorder = "preset-outlined-surface-300-700 p-2";
</script>

<div class="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
    <!-- Search Input -->
    <input
        type="search"
        placeholder="Search achievements..."
        bind:value={sortManager.search}
        class="input border-surface-700 bg-surface-800 text-surface-100 grow py-3"
    />

    <!-- Sort Method Selection -->
    <div class="flex flex-col items-center gap-2 md:flex-row">
        <label class="text-surface-300 text-sm">
            <span hidden>Sort by</span>
            <Segment
                value={sortManager.method}
                onValueChange={(e) => {
                    sortManager.method = e.value as typeof sortManager.method;
                }}
                border={segmentBorder}
                rounded={segmentRounded}
            >
                <Segment.Item classes="text-sm" value="percentage">
                    Rarity
                </Segment.Item>
                <Segment.Item classes="text-sm" value="count">
                    Player Count
                </Segment.Item>
                {#if achievements.find((a) => "unlocked" in a)}
                    <Segment.Item classes="text-sm" value="unlocked">
                        Unlocked
                    </Segment.Item>
                {/if}
            </Segment>
        </label>
    </div>

    <!-- Filter Status Selection -->
    <!-- Only show if there are a mix of unlocked and locked achievements -->
    {#if achievements.every((a) => "unlocked" in a) && achievements.some((a) => a.unlocked) && achievements.some((a) => !a.unlocked)}
        <div class="flex flex-col items-center gap-2 md:flex-row">
            <label class="text-surface-300 text-sm">
                <span hidden>Filter by</span>
                <Segment
                    value={sortManager.filter}
                    onValueChange={(e) => {
                        sortManager.filter =
                            e.value as typeof sortManager.filter;
                    }}
                    border={segmentBorder}
                    rounded={segmentRounded}
                >
                    <Segment.Item labelClasses="text-sm" value="all">
                        <span hidden> All </span>
                        <SquareDashed />
                    </Segment.Item>
                    {#if achievements.find((a) => "unlocked" in a)}
                        <Segment.Item labelClasses="text-sm" value="unlocked">
                            <span hidden> Unlocked </span>
                            <KeyRound />
                        </Segment.Item>
                        <Segment.Item labelClasses="text-sm" value="locked">
                            <span hidden> Locked </span>
                            <Lock />
                        </Segment.Item>
                    {/if}
                </Segment>
            </label>
        </div>
    {/if}

    <!-- Sort Direction Toggle -->
    <button
        onclick={() =>
            (sortManager.direction =
                sortManager.direction === "asc" ? "desc" : "asc")}
        class="btn preset-outlined-surface-300-700 text-surface-300 py-3"
    >
        <!-- These icons are just ArrowUpWideNarrow and ArrowDownNarrowWide from lucide -->
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide-icon lucide lucide-arrow-up-wide-narrow top-0 left-0"
        >
            {#if sortManager.direction === "asc"}
                <path
                    d="m3 8 4-4 4 4"
                    in:receive={{ key: 0 }}
                    out:send={{ key: 0 }}
                ></path>
                <path d="M7 4v16" in:receive={{ key: 1 }} out:send={{ key: 1 }}
                ></path>
                <path
                    d="M11 12h10"
                    in:receive={{ key: 2 }}
                    out:send={{ key: 2 }}
                ></path>
                <path d="M11 16h7" in:receive={{ key: 3 }} out:send={{ key: 3 }}
                ></path>
                <path d="M11 20h4" in:receive={{ key: 4 }} out:send={{ key: 4 }}
                ></path>
            {:else}
                <path
                    d="m3 16 4 4 4-4"
                    in:receive={{ key: 0 }}
                    out:send={{ key: 0 }}
                ></path>
                <path d="M7 20V4" in:receive={{ key: 1 }} out:send={{ key: 1 }}
                ></path>
                <path d="M11 4h4" in:receive={{ key: 2 }} out:send={{ key: 2 }}
                ></path>
                <path d="M11 8h7" in:receive={{ key: 3 }} out:send={{ key: 3 }}
                ></path>
                <path
                    d="M11 12h10"
                    in:receive={{ key: 4 }}
                    out:send={{ key: 4 }}
                ></path>
            {/if}
        </svg>
    </button>
</div>
