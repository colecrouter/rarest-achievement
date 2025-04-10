<script lang="ts">
    import Splash from "$lib/loading/Splash.svelte";
    import Transition from "$lib/Transition.svelte";
    import { TriangleAlert } from "lucide-svelte";
    import Achievements from "./Achievements.svelte";
    import Breadcrumbs from "../../Breadcrumbs.svelte";

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
                <div
                    class="preset-outlined-warning-500 text-warning-500 mb-4 grid grid-cols-1 items-center gap-4 rounded-xl p-4 lg:grid-cols-[auto_1fr_auto]"
                >
                    <TriangleAlert />
                    <div>
                        <p class="font-bold">Warning</p>
                        <p class="text-xs opacity-80">
                            We're still indexing this account, so some info may
                            be missing. Please check back later.
                        </p>
                    </div>
                </div>
            {/if}

            <Achievements {achievements} />
        </Transition>
    {/await}
</main>
