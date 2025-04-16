<script lang="ts" module>
    const podiumConfig = {
        1: {
            zIndex: "20",
            width: "w-[220px]",
            iconComponent: Crown,
            iconWrapper: "h-10 w-10 text-amber-500",
            label: "1st Place",
            labelTextClass: "text-sm font-bold text-amber-500",
            placeStatClass: "text-xs text-amber-500",
            cardWrapper:
                "w-full rounded-t-lg border border-amber-600/30 bg-gray-800 p-4 shadow-lg shadow-amber-900/20",
            iconSize: {
                width: 80,
                height: 80,
                imgClass:
                    "z-10 rounded-md border-2 border-amber-500 bg-gray-900",
            },
            nameTextClass: "mt-2 text-center font-bold text-amber-100",
            appTextClass: "mt-1 text-center text-xs text-amber-300/70",
            gradientBar:
                "w-full h-[160px] border-x border-amber-700/30 bg-gradient-to-t from-amber-900/30 to-gray-800",
        },
        2: {
            zIndex: "10",
            width: "w-[200px]",
            iconComponent: Medal,
            iconWrapper: "h-8 w-8 text-gray-300",
            label: "2nd Place",
            labelTextClass: "text-sm font-medium text-gray-300",
            placeStatClass: "text-xs text-amber-500",
            cardWrapper:
                "w-full rounded-t-lg border border-gray-700 bg-gray-800 p-4",
            iconSize: {
                width: 64,
                height: 64,
                imgClass: "rounded-md border-2 border-gray-700 bg-gray-900",
            },
            nameTextClass: "mt-2 text-center font-bold",
            appTextClass: "mt-1 text-center text-xs text-gray-400",
            gradientBar:
                "w-full h-[120px] border-x border-gray-700 bg-gradient-to-t from-gray-700 to-gray-800",
        },
        3: {
            zIndex: "10",
            width: "w-[180px]",
            iconComponent: Award,
            iconWrapper: "h-7 w-7 text-amber-700",
            label: "3rd Place",
            labelTextClass: "text-sm font-medium text-amber-700",
            placeStatClass: "text-xs text-amber-500",
            cardWrapper:
                "w-full rounded-t-lg border border-gray-700 bg-gray-800 p-4",
            iconSize: {
                width: 56,
                height: 56,
                imgClass: "rounded-md border-2 border-gray-700 bg-gray-900",
            },
            nameTextClass: "mt-2 text-center font-bold",
            appTextClass: "mt-1 text-center text-xs text-gray-400",
            gradientBar:
                "w-full h-[100px] border-x border-gray-700 bg-gradient-to-t from-gray-700 to-gray-800",
        },
    };

    function grow(
        node: HTMLElement,
        params: {
            delay?: number;
            duration?: number;
            easing?: (t: number) => number;
        },
    ) {
        const target = getComputedStyle(node).height.replace("none", "");
        return {
            delay: params.delay || 0,
            duration: params.duration || 400,
            easing: params.easing,
            css: (t: number) => {
                const height = Math.round(t * Number.parseFloat(target));
                return `max-height: ${height}px; overflow: hidden;`;
            },
        };
    }
</script>

<script lang="ts">
    import Medal from "@lucide/svelte/icons/medal";
    import Crown from "@lucide/svelte/icons/crown";
    import Award from "@lucide/svelte/icons/award";
    import { fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import type { SteamAppAchievement } from "lib";

    interface Props {
        place: 1 | 2 | 3;
        achievement: SteamAppAchievement;
    }

    let { place, achievement }: Props = $props();

    const config = $derived(podiumConfig[place]);
    const IconComponent = $derived(config.iconComponent);

    let animate = $state(false);
    $effect(() => {
        animate = true;
    });
</script>

<div
    class={[
        "z- relative",
        config.zIndex,
        config.width,
        "flex flex-col items-center",
    ]}
>
    {#if animate}
        <div
            transition:fade={{ duration: 300, delay: 100 * place + 400 }}
            class="mb-2 flex flex-col items-center"
        >
            <IconComponent class={config.iconWrapper} />
            <span class={config.labelTextClass}>
                {config.label}
            </span>
            <span class={config.placeStatClass}>
                {achievement.globalPercentage}% of players
            </span>
        </div>
        <div class={config.cardWrapper}>
            <div
                class="flex flex-col items-center"
                transition:fade={{ duration: 300, delay: 100 * place + 400 }}
            >
                <a href="/game/{achievement.app.id}">
                    <img
                        src={achievement.icon}
                        alt={achievement.name}
                        width={config.iconSize.width}
                        height={config.iconSize.height}
                        class={config.iconSize.imgClass}
                    />
                </a>
                <a href="/game/{achievement.app.id}}">
                    <h3 class="hover:underline {config.nameTextClass}">
                        {achievement.name}
                    </h3>
                </a>
                <a
                    href="/game/{achievement.app.id}"
                    class="hover:underline {config.appTextClass}"
                >
                    {achievement.app.name}
                </a>
            </div>
        </div>
        <div
            transition:grow={{
                duration: 300,
                delay: 100 * place + 200,
                easing: cubicOut,
            }}
            class={[config.gradientBar]}
        ></div>
    {/if}
</div>
