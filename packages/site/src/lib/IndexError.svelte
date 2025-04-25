<script lang="ts">
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Alert from "./Alert.svelte";
</script>

<Alert
    icon={TriangleAlert}
    title="Warning"
    description="We're still indexing this account, so some info may be missing. Please check back later."
    color="warning"
/>
