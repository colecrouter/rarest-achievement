<script lang="ts">
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
</script>

<div
    class="preset-outlined-warning-500 text-warning-500 mb-4 flex items-center gap-4 rounded-xl p-4"
>
    <TriangleAlert />
    <div>
        <p class="font-bold">Warning</p>
        <p class="text-xs opacity-80">
            We're still indexing this account, so some info may be missing.
            Please check back later.
        </p>
    </div>
</div>
