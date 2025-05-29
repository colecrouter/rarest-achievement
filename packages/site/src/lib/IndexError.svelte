<script lang="ts">
    import { m } from "$lib/paraglide/messages";
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Alert from "./Alert.svelte";
</script>

<Alert
    icon={TriangleAlert}
    title={m.indexErrorTitle()}
    description={m.indexErrorMessage()}
    color="warning"
/>
