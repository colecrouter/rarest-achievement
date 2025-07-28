<script lang="ts">
    import { page } from "$app/state";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    import { locales, localizeHref } from "$lib/paraglide/runtime";
    import "../../app.css";
    import Footer from "./Footer.svelte";
    import Navbar from "./Navbar.svelte";

    const { children, data } = $props();
</script>

<!-- Alternate language links -->
<div style="display: none">
    {#each locales as locale}
        <a rel="alternate" href={localizeHref(page.url.pathname, { locale })}>
            {locale}
        </a>
    {/each}
</div>

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
