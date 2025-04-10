<script lang="ts">
    import Footer from "./Footer.svelte";
    import Navbar from "./Navbar.svelte";
    const { children, data } = $props();
</script>

<div class="flex min-h-screen flex-col">
    <Navbar user={data.loggedIn} />

    <div class="grow">
        {@render children()}
    </div>

    <Footer />
</div>
