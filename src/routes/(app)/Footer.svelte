<script lang="ts">
    import { Trophy } from "lucide-svelte";
</script>

<footer class="border-t border-gray-800 bg-gray-900 py-8">
    <div class="container mx-auto px-4">
        <div class="flex flex-col items-center justify-between md:flex-row">
            <div class="mb-4 flex items-center gap-2 md:mb-0">
                <Trophy class="h-6 w-6 text-amber-500" />
                <span class="text-xl font-bold">Achievement Vault</span>
            </div>
            <div
                class="flex flex-wrap justify-center gap-6 text-sm text-gray-400"
            >
                <a href="#" class="hover:text-gray-100">About</a>
                <a href="#" class="hover:text-gray-100">Features</a>
                <a href="#" class="hover:text-gray-100">Pricing</a>
                <a href="#" class="hover:text-gray-100">Support</a>
                <a href="#" class="hover:text-gray-100">Privacy</a>
                <a href="#" class="hover:text-gray-100">Terms</a>
            </div>
        </div>
        <div
            class="mt-8 border-t border-gray-800 pt-6 text-center text-sm text-gray-500"
        >
            &copy; {new Date().getFullYear()} Achievement Vault. All rights reserved.
        </div>
    </div>
</footer>
