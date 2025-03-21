<script lang="ts">
    import Navbar from "./Navbar.svelte";
    const { children } = $props();
</script>

<nav class="container">
    <Navbar />
</nav>

<main class="container">
    {@render children()}
</main>

<style>
</style>
