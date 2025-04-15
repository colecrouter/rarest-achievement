<script lang="ts">
    import "../app.css";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    const { children, data } = $props();
</script>

<TransitionWrapper>
    {#key data.paths.join("/")}
        <Transition>
            {@render children()}
        </Transition>
    {/key}
</TransitionWrapper>
