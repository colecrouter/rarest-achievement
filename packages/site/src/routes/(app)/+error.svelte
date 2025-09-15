<script lang="ts">
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages.js";
	import { localizeHref } from "$lib/paraglide/runtime";
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import Home from "@lucide/svelte/icons/home";
	import RefreshCcw from "@lucide/svelte/icons/refresh-ccw";

	let error = page.error;

	$effect(() => console.error(error?.message));
</script>

<main
	class="container mx-auto flex flex-col items-center justify-center px-4 py-16"
>
	<!-- Error Illustration -->
	<div class="relative mb-20">
		<div class="relative mx-auto h-32 w-32">
			<div
				class="bg-error-500/20 absolute inset-0 rounded-full blur-xl"
			></div>
			<div
				class="border-surface-700 bg-surface-800 relative rounded-full border p-6"
			>
				<div class="text-error-500 animate-pulse">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-full w-full"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				</div>
			</div>
		</div>
	</div>

	<!-- Error Message -->
	<div class="mb-8 max-w-lg text-center">
		<h2 class="mb-4 text-2xl font-bold">{m.errorPageTitle()}</h2>
		<p class="text-surface-300 mb-6">
			{m.errorPageMessage()}
		</p>
		<!-- Error Details -->
		<div
			class="border-surface-700 bg-surface-800 rounded-container mb-8 overflow-hidden border p-4 text-left font-mono text-sm"
		>
			<div class="text-error-500">&gt; ERROR_UNEXPECTED_CRASH</div>
			<div class="text-surface-300">
				&gt;
				{m.errorPageErrorCause({
					errorMessage: error?.message ?? "Unknown Error",
				})}
			</div>
			<div class="text-surface-300">
				&gt;
				{m.errorPageErrorSuggestion()}
			</div>
			<div class="text-primary-500 animate-pulse">&gt; _</div>
		</div>
	</div>

	<!-- Navigation Options -->
	<div class="flex flex-wrap justify-center gap-4">
		<button
			onclick={() => window.location.reload()}
			class="btn flex items-center gap-2"
		>
			<RefreshCcw class="mr-2 h-4 w-4" />
			{m.errorPageButtonReload()}
		</button>
		<a href={localizeHref("/")} class="inline-block">
			<button
				class="btn preset-outlined-surface-500 flex items-center gap-2"
			>
				<Home class="mr-2 h-4 w-4" />
				{m.errorPageButtonHome()}
			</button>
		</a>
		<button
			onclick={() => window.history.back()}
			class="btn flex items-center gap-2"
		>
			<ArrowLeft class="mr-2 h-4 w-4" />
			{m.errorPageButtonBack()}
		</button>
	</div>
</main>
