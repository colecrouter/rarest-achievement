<script lang="ts">
    const { children } = $props();
</script>

<div class="grid min-h-0 min-w-0 grid-cols-1 grid-rows-1">
    {@render children()}
</div>
