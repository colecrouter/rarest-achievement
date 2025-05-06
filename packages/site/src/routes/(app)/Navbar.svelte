<script lang="ts">
    import LogOut from "@lucide/svelte/icons/log-out";
    import User from "@lucide/svelte/icons/user";
    import type { SteamUser } from "@project/lib";
    import SearchBar from "./SearchBar.svelte";

    interface Props {
        user: SteamUser | null;
    }

    let { user }: Props = $props();
</script>

<header class="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
    <div
        class="d:gap-4 container mx-auto grid grid-flow-col grid-cols-[auto,1fr,auto] items-center gap-2 px-4 py-4 md:flex md:justify-between"
    >
        <!-- Logo and title -->
        <a href="/" class="flex items-center gap-2 md:pr-4">
            <div class="logo bg-primary-500"></div>
            <h1 class="relative hidden text-xl font-bold md:block">
                Steam Vault
                <span
                    class="badge text-primary-500 badge-icon preset-outlined-primary-500 absolute top-0 right-0 translate-x-1/2 -translate-y-1/2"
                >
                    Beta
                </span>
            </h1>
        </a>

        <!-- Centered Search form component on mobile -->
        <div class="col-start-2 col-end-3 min-w-0 md:contents">
            <SearchBar />
        </div>

        <!-- Right aligned user actions -->
        <div class="flex items-center justify-end gap-4">
            {#if user}
                <a
                    href="/user/{user.id}"
                    class="btn btn-sm preset-outlined-primary-500"
                >
                    <User class="mr-2 h-6 w-6" />
                    <span>{user.displayName}</span>
                </a>
                <form
                    action="/?/logout"
                    method="post"
                    class="flex items-center gap-4"
                >
                    <button
                        class="btn btn-sm preset-outlined-surface-500"
                        type="submit"
                    >
                        <LogOut class="my-1 h-4 w-4" />
                        <span hidden> Logout </span>
                    </button>
                </form>
            {:else}
                <form
                    action="/?/login"
                    method="post"
                    class="flex items-center gap-4"
                >
                    <button
                        class="btn btn-sm preset-filled-primary-500"
                        type="submit"
                    >
                        <div>
                            Login
                            <span class="hidden md:inline"> with Steam </span>
                        </div>
                        <svg
                            role="img"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            fill="currentColor"
                        >
                            <title>Steam</title>
                            <path
                                d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"
                            />
                        </svg>
                    </button>
                </form>
            {/if}
        </div>
    </div>
</header>

<style>
    .logo {
        -webkit-mask: url(/logo.svg) no-repeat center;
        mask: url(/logo.svg) no-repeat center;
        width: 2.5rem;
        height: 2.5em;
        stroke: currentColor;
    }

    header {
        /* This is so that the header is above the rest of the page content */
        z-index: 1;
    }
</style>
