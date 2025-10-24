<script lang="ts">
	import Alert from "$lib/Alert.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { localizeHref } from "$lib/paraglide/runtime";
	import GlobeLock from "@lucide/svelte/icons/globe-lock";
</script>

<article>
	<div class="space-y-12">
		<!-- Step 1 -->
		<section>
			<h2 class="text-2xl">{m["profile.steps.step1.title"]()}</h2>
			<div class="p-6">
				<p class="mb-6">
					{m["profile.steps.step1.description"]()}
				</p>

				<!-- Steam Profile UI Recreation -->
				<div class="text-surface-300 mb-6">
					<div class="flex items-start p-4">
						<div class="mr-4">
							<div class="placeholder h-32 w-32"></div>
						</div>

						<div class="flex-1">
							<div class="flex items-start justify-between">
								<div>
									<h3 class="mb-2 text-2xl font-bold">
										Username
									</h3>

									<!-- Name -->
									<div class="placeholder mb-4 w-24"></div>

									<!-- Bio -->
									<div class="flex flex-col gap-2">
										<div class="flex gap-2">
											<div class="placeholder w-48"></div>
											<div class="placeholder w-16"></div>
										</div>

										<div class="flex flex-col gap-2">
											<div class="flex gap-2">
												<div
													class="placeholder w-32"
												></div>
												<div
													class="placeholder w-32"
												></div>
											</div>
										</div>
									</div>
								</div>

								<div class="flex w-48 flex-col items-start">
									<h2 class="mb-2 text-xl">Level 50</h2>
									<button
										class="bg-surface-800 pointer-events-none rounded px-4 py-2"
									>
										Edit Profile
									</button>
								</div>
							</div>
						</div>
					</div>

					<div class="bg-surface-950 rounded-container p-4">
						<h4 class="text-surface-300 mb-2">
							Rarest Achievement Showcase
						</h4>
						<div class="mb-4 grid grid-cols-6 gap-2">
							{#each Array(6)}
								<div
									class="placeholder aspect-square w-full rounded"
								></div>
							{/each}
						</div>

						<div class="grid grid-cols-3 gap-4">
							<div>
								<p class="text-3xl font-bold">1,234</p>
								<p class="text-surface-300">Achievements</p>
							</div>
							<div>
								<p class="text-3xl font-bold">3</p>
								<p class="text-surface-300">Perfect Games</p>
							</div>
							<div>
								<p class="text-3xl font-bold">42%</p>
								<p class="text-surface-300">Avg. Completion</p>
							</div>
						</div>
					</div>
				</div>

				<p>
					{m["profile.steps.step1.action"]()}
					<strong class="text-white"
						>{m["profile.editProfile.button"]()}</strong
					>.
				</p>
			</div>
		</section>

		<!-- Step 2 -->
		<section>
			<h2 class="text-2xl">{m["profile.steps.step2.title"]()}</h2>
			<div class="p-6">
				<p class="mb-6">
					{m["profile.steps.step2.description"]()}
				</p>

				<!-- Steam Edit Profile UI Recreation -->
				<div class="text-surface-300 mb-6">
					<div class="flex p-4">
						<div class="flex items-center">
							<div
								class="placeholder mr-3 h-12 w-12 rounded"
							></div>
							<div class="flex items-center">
								<h3 class="text-xl">Username</h3>
								<span class="text-surface-500 mx-2"
									>&raquo;</span
								>
								<div class="text-sm">Edit Profile</div>
							</div>
						</div>
					</div>

					<div class="flex">
						<!-- Sidebar -->
						<div class="bg-surface-950 w-48 space-y-3 p-4">
							{#each ["General", "Avatar", "Profile Background", "Mini Profile"] as item}
								<div>
									{item}
								</div>
							{/each}

							<hr class="border-surface-700" />

							<div
								class="bg-surface-700 rounded px-2 py-1 text-white"
							>
								Privacy Settings
							</div>
						</div>

						<!-- Main Content -->
						<div class="flex flex-col gap-2 p-4">
							<div class="placeholder mb-2 h-8 w-24"></div>
							<div class="placeholder w-64"></div>
							<div class="placeholder w-48"></div>

							<div class="placeholder my-2 h-8 w-32"></div>
							<div class="placeholder w-64"></div>
							<div class="placeholder w-48"></div>
						</div>
					</div>
				</div>

				<p>
					{m["profile.steps.step2.action"]()}
					<strong>{m["profile.privacy.settings"]()}</strong>.
				</p>
			</div>
		</section>

		<!-- Step 3 -->
		<section>
			<h2 class="text-2xl">{m["profile.steps.step3.title"]()}</h2>
			<div class="p-6">
				<p class="mb-6">
					{m["profile.steps.step3.description"]()}
				</p>

				<!-- Steam Privacy Settings UI Recreation -->
				<div class="text-surface-300">
					<div class="p-6">
						<div class="mb-4 flex flex-col gap-2">
							<h3 class=" text-surface-300">
								My profile: <span class="text-white"
									>Public</span
								>
								<span>▼</span>
							</h3>
							<div class="flex gap-2">
								<div class="placeholder w-48"></div>
								<div class="placeholder w-72"></div>
								<div class="placeholder w-12"></div>
							</div>
							<div class="flex gap-2">
								<div class="placeholder w-32"></div>
								<div class="placeholder w-32"></div>
								<div class="placeholder w-64"></div>
							</div>
						</div>

						<div class="ml-12">
							<div
								class="bg-surface-950 rounded-container -mx-4 mb-2 p-4"
							>
								<h3 class="text-surface-300 mb-2">
									Game details:
									<span class="text-white">Public</span>
									<span>▼</span>
								</h3>

								<div class="flex flex-col gap-2">
									<div class="flex gap-2">
										<div class="placeholder w-12"></div>
										<div class="placeholder w-48"></div>
										<div class="placeholder w-72"></div>
									</div>
									<div class="flex gap-2">
										<div class="placeholder w-32"></div>
										<div class="placeholder w-64"></div>
										<div class="placeholder w-32"></div>
									</div>
								</div>
							</div>

							<div class="mb-4">
								<h3 class="text-surface-300 mb-2">
									Friends List:
									<span class="text-white">Public</span>
									<span>▼</span>
								</h3>
								<div class="flex gap-2">
									<div class="placeholder w-64"></div>
									<div class="placeholder w-12"></div>
									<div class="placeholder w-48"></div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="mt-4">
					<Alert
						color="warning"
						icon={GlobeLock}
						title={m["profile.steps.step3.alert.title"]()}
						description={m[
							"profile.steps.step3.alert.description"
						]()}
					/>
				</div>
			</div>
		</section>

		<!-- Step 4 -->
		<section>
			<h2 class="text-2xl">{m["profile.steps.step4.title"]()}</h2>
			<div class="p-6">
				{m["profile.steps.step4.description"]()}
			</div>
		</section>

		<section>
			<h2 class="text-2xl">{m["profile.privacy.concerns.title"]()}</h2>

			<div class="p-6">
				<p class="mb-2">
					{m["profile.privacy.concerns.description"]()}
				</p>
				<p>
					{m["profile.privacy.concerns.more"]()}
					<a
						href={localizeHref("/legal")}
						class="text-primary-500 hover:underline"
						>{m["profile.privacy.linkText"]()}</a
					>.
				</p>
			</div>
		</section>
	</div>
</article>

<style>
	article {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}
</style>
