<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/state";
    import Gamepad from "@lucide/svelte/icons/gamepad";
    import User from "@lucide/svelte/icons/user";
    import { Popover } from "@skeletonlabs/skeleton-svelte";
    import { SteamSearchApp, SteamSearchUser } from "lib";
    import { fade } from "svelte/transition";
    import type { AppsResponse } from "../(api)/search/apps/+server";
    import type { UsersResponse } from "../(api)/search/users/+server";

    let query = $state("");

    // Null as placeholder value
    let appsPromise = $state(Promise.resolve<AppsResponse | null>(null));
    let usersPromise = $state(Promise.resolve<UsersResponse | null>(null));

    // Seperate error state, to manage red outline + shake animation
    let returnedError = $state(false);
    let failed = $derived(
        query !== "" && (returnedError || page.status === 400),
    );

    // Bound property used to animate the height of the popover
    let maxHeight = $state<number>(0);

    // Used to manage the open/close state of the popover
    let isFocused = $state(false);

    // Portal action to append the overlay to the body
    // I can't seem to get it to display the way I want it to in the current DOM
    export function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) node.parentNode.removeChild(node);
            },
        };
    }

    // Fetch the search results when the input changes
    let debounceTimeout: NodeJS.Timeout;
    function debouncedSearchGames(q: string) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            appsPromise = fetch(`/search/apps?q=${encodeURIComponent(q)}`).then(
                (response) => {
                    if (!response.ok) throw new Error("Network error for apps");
                    return response.json();
                },
            );
            usersPromise = fetch(
                `/search/users?q=${encodeURIComponent(q)}`,
            ).then((response) => {
                if (!response.ok) throw new Error("Network error for users");
                return response.json();
            });

            // Set the timeout window here
        }, 500);
    }

    // Unified function to reset the search state after a search is completed
    function reset() {
        query = "";
        isFocused = false;
        appsPromise = Promise.resolve(null);
        usersPromise = Promise.resolve(null);
    }
</script>

<!-- Loading state -->
{#snippet loading()}
    <li class="flex w-full flex-col gap-2">
        <p class="text-surface-400 text-sm">
            Searching for "{query}"...
        </p>
    </li>
{/snippet}

<!-- Error state -->
{#snippet error(error: Error)}
    <li class="flex w-full flex-col gap-2">
        <p class="text-surface-400 text-sm">
            {#if error instanceof Error}
                Error: {error.message}
            {:else}
                An unknown error occurred
            {/if}
        </p>
    </li>
{/snippet}

<!-- App/user list -->
{#snippet list(res: AppsResponse | UsersResponse | null)}
    <!-- Here I put list before the #if because it seems to cause some weird race condition at runtime.
    Unfortunately, that makes it a bit of a mess. -->
    {@const list = res === null ? null : "apps" in res ? res.apps : res.users}
    {#if list}
        {#each list as res, i ("appid" in res ? res.appid : res.userId)}
            {@const obj =
                "appid" in res
                    ? new SteamSearchApp(res)
                    : new SteamSearchUser(res)}
            <!-- Fade animation applied to `in` only, I haven't yet found an `out` animation that doesn't make it look too goofy -->
            <li class="flex flex-col gap-2" in:fade|global={{ delay: i * 50 }}>
                <a
                    href={obj instanceof SteamSearchApp
                        ? `/game/${obj.id}`
                        : `/user/${obj.id}`}
                    class="hover:bg-surface-400 flex items-center gap-2 rounded-lg p-2"
                    onclick={() => {
                        // Reset the query and close the popover
                        reset();
                    }}
                >
                    <img
                        src={obj instanceof SteamSearchApp
                            ? obj.icon
                            : obj.avatar}
                        alt={obj.name}
                        class="h-8 w-8 rounded-lg"
                    />

                    <!-- Grows to fill space, truncates text with ... -->
                    <span class="flex-grow truncate">{obj.name}</span>

                    {#if obj instanceof SteamSearchUser}
                        <User class="h-4 w-4 flex-shrink-0" />
                    {:else}
                        <Gamepad class="h-4 w-4 flex-shrink-0" />
                    {/if}
                </a>
            </li>
        {/each}

        <!-- If the results are truncated, display text to let the user know -->
        {#if res && res.total - list.length > 0}
            <li>
                <p class="text-surface-400 text-sm">
                    {res.total - list.length} more results...
                </p>
            </li>
        {/if}

        {#if res && list.length === 0}
            <li>
                <p class="text-surface-400 text-sm">
                    No {"apps" in res ? "apps" : "users"} found for "{query}".
                </p>
            </li>
        {/if}
    {:else}
        <li>
            <p class="text-surface-400 text-sm">
                No results found for "{query}".
            </p>
        </li>
    {/if}
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

                reset();
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
        autocomplete="off"
        bind:value={query}
        oninput={() => {
            // Reset the error state when the input changes
            returnedError = false;

            debouncedSearchGames(query);
        }}
        onfocus={() => (isFocused = true)}
        class:failed
    />

    <Popover
        open={isFocused}
        triggerBase="w-full"
        contentBase="card left-0 w-[calc(100vw-16px)] md:w-[360px] lg:w-[480px] bg-surface-200-800 p-4 space-y-4"
        triggerClasses="block h-0"
        zIndex={"10"}
        autoFocus={false}
    >
        {#snippet content()}
            <div
                class="overflow-hidden"
                style:transition="max-height 0.25s ease-in-out"
                style:max-height={`${maxHeight}px`}
            >
                <ul class="w-full" bind:clientHeight={maxHeight}>
                    <!-- Apps Section -->
                    {#await appsPromise}
                        {@render loading()}
                    {:then appsRes}
                        {@render list(appsRes)}
                    {:catch err}
                        {@render error(err)}
                    {/await}

                    <hr class="text-surface-500 my-2" />

                    <!-- Users Section -->
                    {#await usersPromise}
                        {@render loading()}
                    {:then usersRes}
                        {@render list(usersRes)}
                    {:catch err}
                        {@render error(err)}
                    {/await}
                </ul>
            </div>
        {/snippet}
        {#snippet trigger()}
            <!-- Required to align the popover with the search bar -->
            <div class="w-full"></div>
        {/snippet}
    </Popover>
</form>

{#if isFocused}
    <!-- Use the portal action to move overlay to document.body -->
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
        class="popover-overlay"
        use:portal
        onclick={() => {
            // Close the popover, don't reset the query
            isFocused = false;
        }}
    ></button>
{/if}

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

    .popover-overlay {
        all: unset;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        cursor: pointer;
    }

    :global(html, body) {
        height: 100%;
    }
</style>
