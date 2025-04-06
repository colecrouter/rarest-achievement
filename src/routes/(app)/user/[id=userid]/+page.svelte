<script lang="ts">
    import Splash from "$lib/loading/Splash.svelte";
    import Transition from "$lib/Transition.svelte";
    import Achievements from "./Achievements.svelte";

    let { data } = $props();
</script>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    {#await data.achievements}
        <Transition>
            <Splash message={data.message} />
        </Transition>
    {:then achievements}
        <Transition>
            <Achievements {achievements} />
        </Transition>
    {/await}
</main>
