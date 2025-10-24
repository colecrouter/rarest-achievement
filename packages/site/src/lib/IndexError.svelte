<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
	import Alert from "./Alert.svelte";
</script>

<div data-testid="index-error">
	<Alert
		icon={TriangleAlert}
		title={m["index.error.title"]()}
		description={m["index.error.message"]()}
		color="warning"
	/>
</div>
