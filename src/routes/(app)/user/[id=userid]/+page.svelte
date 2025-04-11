<script lang="ts">
    import Splash from "$lib/loading/Splash.svelte";
    import Transition from "$lib/Transition.svelte";
    import { TriangleAlert } from "lucide-svelte";
    import Achievements from "./Achievements.svelte";
    import Breadcrumbs from "../../Breadcrumbs.svelte";
    import IndexError from "$lib/IndexError.svelte";

    let { data } = $props();
</script>

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

            <Achievements {achievements} />
        </Transition>
    {/await}
</main>
