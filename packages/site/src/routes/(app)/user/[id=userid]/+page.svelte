<script lang="ts">
    import IndexError from "$lib/IndexError.svelte";
    import Transition from "$lib/Transition.svelte";
    import Splash from "$lib/loading/Splash.svelte";
    import Breadcrumbs from "../../Breadcrumbs.svelte";
    import Achievements from "./Achievements.svelte";
    import { m } from "$lib/paraglide/messages.js";

    let { data } = $props();
</script>

<svelte:head>
    <title>{m.userPageMetaTitle({ displayName: data.user.displayName })}</title>
    <meta name="description" content={m.userPageMetaDescription()} />
    <meta
        name="keywords"
        content={m.userPageMetaKeywords({
            userId: data.user.id,
            displayName: data.user.displayName,
        })}
    />
    <meta
        property="og:title"
        content={m.userPageMetaTitle({ displayName: data.user.displayName })}
    />
    <meta property="og:description" content={m.userPageMetaDescription()} />
    <meta property="og:image" content={data.user.avatar} />
    <meta property="og:url" content={data.user.profileUrl} />
    <meta property="og:type" content="summary" />
    <meta property="twitter:card" content="summary" />
</svelte:head>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    <Breadcrumbs path={data.breadcrumbs} />

    {#await data.achievements}
        <Transition>
            <Splash message={data.message} />
        </Transition>
    {:then { achievements, didErr }}
        <Transition>
            {#if didErr}
                <IndexError />
            {/if}

            <Achievements user={data.user} {achievements} />
        </Transition>
    {/await}
</main>
