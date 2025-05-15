<script lang="ts">
    import Trophy from "@lucide/svelte/icons/trophy";
</script>

<footer class="border-surface-800 bg-surface-900 border-t py-8">
    <div class="container mx-auto px-4">
        <div class="flex flex-col items-center justify-between md:flex-row">
            <div class="mb-4 flex items-center gap-2 md:mb-0">
                <Trophy class="text-primary-500 h-6 w-6" />
                <span class="text-xl font-bold">Steam Vault</span>
            </div>
            <div
                class="text-surface-300 flex flex-wrap justify-center gap-6 text-sm"
            >
                <a href="/about" class="hover:text-surface-100">About</a>
                <a href="/legal#support" class="hover:text-surface-100"
                    >Support</a
                >
                <a href="/legal" class="hover:text-surface-100">Privacy</a>
                <a href="/legal?tab=terms" class="hover:text-surface-100"
                    >Terms</a
                >
            </div>
        </div>
        <div
            class="text-surface-300 border-surface-800 mt-8 border-t pt-6 text-center text-sm"
        >
            &copy; {new Date().getFullYear()} Steam Vault. All rights reserved.
        </div>
    </div>
</footer>
