<script lang="ts">
    import { TriangleAlert } from "lucide-svelte";
</script>

<div
    class="preset-outlined-warning-500 text-warning-500 mb-4 grid grid-cols-1 items-center gap-4 rounded-xl p-4 lg:grid-cols-[auto_1fr_auto]"
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
