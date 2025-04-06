<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<div transition:fade|local={{ duration: 300 }}>
    <slot></slot>
</div>
