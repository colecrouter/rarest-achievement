<script lang="ts">
    import { setSortManager } from "$lib/SortManager/UrlParamMapper.svelte";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import Footer from "./Footer.svelte";
    import Navbar from "./Navbar.svelte";
    const { children, data } = $props();

    // Initialize the universal sort manager
    setSortManager();
</script>

<div class="flex min-h-screen flex-col">
    <Navbar user={data.loggedIn} />

    <TransitionWrapper>
        {#key data.paths.join("/")}
            <Transition>
                <div class="grow">
                    {@render children()}
                </div>
            </Transition>
        {/key}
    </TransitionWrapper>

    <Footer />
</div>
