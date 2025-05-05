<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/state";
    import Gamepad from "@lucide/svelte/icons/gamepad";
    import User from "@lucide/svelte/icons/user";
    import { Popover } from "@skeletonlabs/skeleton-svelte";
    import type { _Response } from "../(api)/search/+server";
    import { SteamSearchApp, SteamSearchUser } from "lib";
    import SearchIcon from "@lucide/svelte/icons/search";

    let query = $state("");

    let debounceTimeout: NodeJS.Timeout;

    // Combined debounce and fetch function
    const debouncedFetchSearch = (q: string) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            resultPromise = fetch(`/search?q=${encodeURIComponent(q)}`).then(
                (response) => {
                    if (!response.ok) {
                        throw new Error("Network response was not ok");
                    }
                    return response.json();
                },
            );
        }, 500);
    };

    // Updated searchGames to use the combined function
    const searchGames = (query: string) => {
        debouncedFetchSearch(query);
    };

    let resultPromise = $state(Promise.resolve<_Response | null>(null));

    let returnedError = $state(false);
    let failed = $derived(
        query !== "" && (returnedError || page.status === 400),
    );
</script>

{#snippet loading()}
    <div class="flex w-full flex-col gap-2">
        <p class="text-surface-400 text-sm">
            Searching for "{query}"...
        </p>
    </div>
{/snippet}

<!-- Search form markup -->
<form
    class="flex-grow"
    action="/?/search"
    method="post"
    use:enhance={() => {
        returnedError = false;

        return async ({ result, update }) => {
            if (result.status === 200) {
                await update();
            } else {
                returnedError = true;
            }
        };
    }}
>
    <input
        class="input"
        type="text"
        name="q"
        placeholder="Enter a username, profile link, or game..."
        bind:value={query}
        oninput={() => searchGames(query)}
        class:failed
    />

    <Popover
        open={query.length > 0}
        triggerBase="w-full"
        contentBase="card w-full w-[360px] lg:w-[480px] bg-surface-200-800 p-4 space-y-4"
        triggerClasses="block h-0"
        autoFocus={false}
    >
        {#snippet content()}
            <ul class="w-full">
                {#await resultPromise}
                    {@render loading()}
                {:then res}
                    {#if !res}
                        {@render loading()}
                    {:else}
                        {@const { apps, users } = res}
                        {#if apps.apps.length > 0}
                            <li class="flex w-full flex-col gap-2">
                                {#each apps.apps as res}
                                    {@const app = new SteamSearchApp(res)}
                                    <a
                                        href="/game/{app.id}"
                                        class="hover:bg-surface-400 flex items-center gap-2 rounded-lg p-2"
                                        onclick={() => {
                                            query = "";
                                        }}
                                    >
                                        <img
                                            src={app.icon}
                                            alt={app.name}
                                            class="h-8 w-8 rounded-lg"
                                        />
                                        <span class="flex-grow truncate">
                                            {app.name}
                                        </span>
                                        <Gamepad
                                            class="h-4 w-4 flex-shrink-0"
                                        />
                                    </a>
                                {/each}

                                {#if apps.total - apps.apps.length > 0}
                                    <p class="text-surface-400 text-sm">
                                        {apps.total - apps.apps.length} more results...
                                    </p>
                                {/if}
                            </li>
                        {:else}
                            <div class="flex w-64 flex-col gap-2">
                                <p class="text-surface-400 text-sm">
                                    No apps found for "{query}"
                                </p>
                            </div>
                        {/if}

                        <hr class="text-surface-500 my-2" />

                        {#if users.users.length > 0}
                            <div class="flex w-full flex-col gap-2">
                                {#each users.users as res}
                                    {@const user = new SteamSearchUser(res)}
                                    <a
                                        href="/user/{user.id}"
                                        class="hover:bg-surface-400 flex items-center gap-2 rounded-lg p-2"
                                        onclick={() => {
                                            query = "";
                                        }}
                                    >
                                        <img
                                            src={user.avatar}
                                            alt={user.name}
                                            class="h-8 w-8 rounded-lg"
                                        />
                                        <span class="flex-grow truncate">
                                            {user.name}
                                        </span>
                                        <User class="h-4 w-4 flex-shrink-0" />
                                    </a>
                                {/each}

                                {#if users.total - users.users.length > 0}
                                    <p class="text-surface-400 text-sm">
                                        {users.total - users.users.length} more results...
                                    </p>
                                {/if}
                            </div>
                        {:else}
                            <div class="flex w-64 flex-col gap-2">
                                <p class="text-surface-400 text-sm">
                                    No users found for "{query}"
                                </p>
                            </div>
                        {/if}
                    {/if}
                {:catch error}
                    <div class="flex w-64 flex-col gap-2">
                        <p class="text-surface-400 text-sm">
                            Error: {error.message}
                        </p>
                    </div>
                {/await}
            </ul>
        {/snippet}
        {#snippet trigger()}
            <!-- Required to align the popover with the search bar -->
            <div class="w-full"></div>
        {/snippet}
    </Popover>
</form>

<style>
    .failed {
        animation: shake 0.5s ease-in-out;
        animation-fill-mode: forwards;
    }

    .failed:focus-within {
        --tw-ring-color: var(--color-red-500);
    }

    @keyframes shake {
        0% {
            transform: translateX(0);
        }
        25% {
            transform: translateX(-5px);
        }
        50% {
            transform: translateX(5px);
        }
        75% {
            transform: translateX(-5px);
        }
        100% {
            transform: translateX(0);
        }
    }

    .input {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='oklch(0.967 0.003 264.542)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' %3E%3Cpath d='m21 21-4.34-4.34' /%3E%3Ccircle cx='11' cy='11' r='8' /%3E%3C/svg%3E")
            no-repeat 8px center;
        padding-left: 2.5rem;
    }
</style>
