<script lang="ts">
    import Footer from "./Footer.svelte";
    import Navbar from "./Navbar.svelte";
    const { children, data } = $props();
</script>

<Navbar user={data.user} />

{@render children()}

<Footer />
