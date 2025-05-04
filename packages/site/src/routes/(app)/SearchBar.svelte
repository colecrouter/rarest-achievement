<script lang="ts">
    import { Popover } from "@skeletonlabs/skeleton-svelte";
    import type { SteamStoreAPIClient } from "lib";
    import Gamepad from "@lucide/svelte/icons/gamepad";

    let query = $state("");

    const debounce = <T,>(func: (...args: T[]) => void, delay: number) => {
        let timeout: NodeJS.Timeout;
        return (...args: T[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func(...args);
            }, delay);
        };
    };

    let resultPromise = $state<
        ReturnType<(typeof SteamStoreAPIClient)["searchApps"]>
    >(Promise.resolve([]));

    const search = async (query: string) => {
        debounce(() => {
            resultPromise = fetch(
                `/search?q=${encodeURIComponent(query)}`,
            ).then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            });
        }, 500)();
    };
</script>

<!-- Search form markup -->
<form class="flex-grow" action="/?/search" method="post">
    <input
        class="input"
        type="text"
        name="q"
        placeholder="Enter a username, profile, or game"
        bind:value={query}
        oninput={() => search(query)}
    />

    <Popover
        open={query.length > 0}
        triggerBase="w-full"
        contentBase="card w-full w-[360px] lg:w-[480px] bg-surface-200-800 p-4 space-y-4"
        autoFocus={false}
        portalled={false}
    >
        {#snippet content()}
            <div class="w-full">
                {#await resultPromise}
                    <div class="flex w-full flex-col gap-2">
                        <p class="text-surface-400 text-sm">
                            Searching for "{query}"...
                        </p>
                    </div>
                {:then results}
                    {#if results.length > 0}
                        <div class="flex w-full flex-col gap-2">
                            {#each results as result}
                                <a
                                    href="/game/{result.appid}"
                                    class="hover:bg-surface-400 flex items-center gap-2 rounded-lg p-2"
                                    onclick={() => {
                                        query = "";
                                    }}
                                >
                                    <img
                                        src={result.icon}
                                        alt={result.name}
                                        class="h-8 w-8 rounded-lg"
                                    />
                                    <span class="flex-grow truncate">
                                        {result.name}
                                    </span>
                                    <Gamepad class="h-4 w-4 flex-shrink-0" />
                                </a>
                            {/each}
                        </div>
                    {:else}
                        <div class="flex w-64 flex-col gap-2">
                            <p class="text-surface-400 text-sm">
                                No results found for "{query}"
                            </p>
                        </div>
                    {/if}
                {:catch error}
                    <div class="flex w-64 flex-col gap-2">
                        <p class="text-surface-400 text-sm">
                            Error: {error.message}
                        </p>
                    </div>
                {/await}
            </div>
        {/snippet}
        {#snippet trigger()}
            <!-- Required to align the popover with the search bar -->
            <div class="w-full"></div>
        {/snippet}
    </Popover>
</form>
