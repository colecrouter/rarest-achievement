<script lang="ts">
    import "../app.css";
    import { i18n } from "$lib/i18n";
    import { ParaglideJS } from "@inlang/paraglide-sveltekit";
    import Transition from "$lib/Transition.svelte";
    import TransitionWrapper from "$lib/TransitionWrapper.svelte";
    const { children, data } = $props();
</script>

<ParaglideJS {i18n}>
    <TransitionWrapper>
        {#key data.paths.join("/")}
            <Transition>
                {@render children()}
            </Transition>
        {/key}
    </TransitionWrapper>
</ParaglideJS>
