<script lang="ts">
    import "../app.css";
    import { i18n } from "$lib/i18n";
    import { ParaglideJS } from "@inlang/paraglide-sveltekit";
    const { children } = $props();
</script>

<ParaglideJS {i18n}>
    {@render children()}
</ParaglideJS>
