<script lang="ts">
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Alert from "./Alert.svelte";
    import { m } from "$lib/paraglide/messages";
</script>

<Alert
    icon={TriangleAlert}
    title={m.indexErrorTitle()}
    description={m.indexErrorMessage()}
    color="warning"
/>
