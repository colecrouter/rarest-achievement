<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Tabs } from "@skeletonlabs/skeleton-svelte";
    import { ArrowLeft, Shield } from "lucide-svelte";
    import Breadcrumbs from "../Breadcrumbs.svelte";

    let activeTab = $derived.by(() => {
        switch (page.url.searchParams.get("tab")) {
            case "terms":
                return "terms";
            default:
                return "privacy";
        }
    });

    const { breadcrumbs } = $props();
</script>

<svelte:head>
    <title>Steam Vault - Legal</title>
    <meta
        name="description"
        content="Privacy Policy and Terms of Service for Steam Vault."
    />
    <link rel="canonical" href="/legal" />
    <meta property="og:title" content="Steam Vault - Legal" />
    <meta
        property="og:description"
        content="Privacy Policy and Terms of Service for Steam Vault."
    />
    <meta property="og:type" content="website" />
</svelte:head>

<!-- Main content translated from React (skipping header and footer) -->
<main class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <Breadcrumbs path={breadcrumbs} />

    <div class="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <a href="/" class="flex items-center hover:text-gray-100">
            <ArrowLeft class="mr-1 h-4 w-4" />
            Back to Home
        </a>
        <span>/</span>
        <span class="text-gray-100">Legal</span>
    </div>

    <!-- Page Header -->
    <div class="mb-8 flex items-center gap-4">
        <div class="rounded-lg bg-amber-500/10 p-3">
            <Shield class="h-8 w-8 text-amber-500" />
        </div>
        <div>
            <h1 class="text-3xl font-bold">
                Privacy Policy &amp; Terms of Service
            </h1>
            <p class="text-gray-400">Last updated: April 9, 2025</p>
        </div>
    </div>

    <!-- Disclaimer -->
    <div
        class="card preset-outlined-surface-950-50 mb-8 grid w-full grid-cols-1 items-center gap-4 p-4 lg:grid-cols-[1fr_auto]"
    >
        <div>
            <p class="font-bold">Disclaimer</p>
            <p class="text-xs opacity-60">
                Steam Vault is in <b>no way</b> associated with Valve Corporation.
                All registered trademarks or service marks are the property of their
                respective owners. All registered assets are used under fair use.
            </p>
        </div>
    </div>

    <!-- Updated Tabs system -->
    <Tabs
        value={activeTab}
        onValueChange={(v) => {
            switch (v.value) {
                case "terms":
                    goto("/legal?tab=terms");
                    break;
                default:
                    goto("/legal");
            }
        }}
    >
        {#snippet list()}
            <Tabs.Control value="privacy">Privacy Policy</Tabs.Control>
            <Tabs.Control value="terms">Terms of Service</Tabs.Control>
        {/snippet}

        {#snippet content()}
            <Tabs.Panel value="privacy">
                <div class="prose max-w-none pt-4">
                    <blockquote>
                        This Privacy Policy describes how Steam Vault ("we",
                        "our", or "us") collects, uses, and shares your personal
                        information when you use our website and services. By
                        using Steam Vault, you agree to the collection and use
                        of information in accordance with this policy.
                    </blockquote>

                    <!-- Section: Information We Collect -->
                    <section>
                        <h2>Information We Collect</h2>
                        <p>
                            We collect several types of information from and
                            about users of our platform, including:
                        </p>
                        <ul>
                            <li>
                                <strong>Steam Account Details:</strong>
                                We store publicly available information from any
                                Steam profiles entered on our site.
                            </li>
                            <li>
                                <strong>Usage Data:</strong>
                                We collect information about how you interact with
                                our platform, including the pages you visit, features
                                you use, and time spent on the platform.
                            </li>
                            <li>
                                <strong>Device Information:</strong>
                                We collect information about your device, including
                                your IP address, browser type, and operating system.
                            </li>
                        </ul>
                    </section>

                    <!-- Section: How We Use Your Information -->
                    <section>
                        <h2>How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul>
                            <li>Provide, maintain, and improve our services</li>
                            <li>
                                Investigate and prevent fraudulent use of our
                                platform
                            </li>
                        </ul>
                    </section>

                    <!-- Section: Sharing Your Information -->
                    <section>
                        <h2>Sharing Your Information</h2>
                        <p>
                            Personal information acquired by us is not shared
                            with any third parties, except in the following
                            cases:
                        </p>
                        <ul>
                            <li>
                                <strong>For Legal Reasons:</strong> We may share
                                information if we believe disclosure is necessary
                                to comply with the law, legal processes, or government
                                requests.
                            </li>
                            <li>
                                <strong>To Protect Rights:</strong> We may share
                                information to protect the rights, property, and
                                safety of Steam Vault, our users, and the public.
                            </li>
                        </ul>
                    </section>

                    <!-- Section: Data Security -->
                    <section>
                        <h2>Data Security</h2>
                        <p>
                            We implement appropriate technical and
                            organizational measures to protect the security of
                            your personal information. However, please be aware
                            that no method of transmission over the internet or
                            electronic storage is 100% secure, and we cannot
                            guarantee absolute security.
                        </p>
                    </section>

                    <!-- Section: Your Rights -->
                    <section>
                        <h2>Your Rights</h2>
                        <p>
                            Depending on your location, you may have certain
                            rights regarding your personal information,
                            including:
                        </p>
                        <ul>
                            <li>
                                The right to access the personal information we
                                have about you
                            </li>
                            <li>
                                The right to request correction of inaccurate
                                personal information
                            </li>
                            <li>
                                The right to request deletion of your personal
                                information
                            </li>
                            <li>
                                The right to object to processing of your
                                personal information
                            </li>
                            <li>The right to data portability</li>
                            <li>The right to withdraw consent</li>
                        </ul>
                        <p>
                            To exercise these rights, please contact us at
                            privacy@todo.com.
                        </p>
                    </section>

                    <!-- Section: Cookies and Tracking Technologies -->
                    <section>
                        <h2>Cookies and Tracking Technologies</h2>
                        <p>
                            We use cookies and similar tracking technologies to
                            track activity on our platform and hold certain
                            information. You can instruct your browser to refuse
                            all cookies or to indicate when a cookie is being
                            sent. However, if you do not accept cookies, you may
                            not be able to use some portions of our platform.
                        </p>
                    </section>

                    <!-- Section: Changes to This Privacy Policy -->
                    <section>
                        <h2>Changes to This Privacy Policy</h2>
                        <p>
                            We may update our Privacy Policy from time to time.
                            We will notify you of any changes by posting the new
                            Privacy Policy on this page and updating the "Last
                            updated" date. You are advised to review this
                            Privacy Policy periodically for any changes.
                        </p>
                    </section>
                </div>
            </Tabs.Panel>

            <Tabs.Panel value="terms">
                <div class="prose max-w-none pt-4">
                    <blockquote>
                        These Terms of Service ("Terms") govern your access to
                        and use of Steam Vault's website and services. By
                        accessing or using our services, you agree to be bound
                        by these Terms. If you do not agree to these Terms, you
                        may not access or use our services.
                    </blockquote>

                    <!-- Section: User Accounts -->
                    <section>
                        <h2>User Accounts</h2>
                        <p>
                            To access certain features of our platform, you may
                            need to sign in with a Steam account. You are
                            responsible for safeguarding your account
                            credentials and for all activities that occur under
                            your account.
                        </p>
                        <p>
                            By using our services, you waive the right to pursue
                            any legal action against us for any unauthorized
                            access to your account. If you believe your account
                            has been compromised on our platform, please contact
                            us below.
                        </p>
                    </section>

                    <!-- Section: Acceptable Use -->
                    <section>
                        <h2>Acceptable Use</h2>
                        <p>
                            You agree to use our services only for lawful
                            purposes and in accordance with these Terms. You
                            agree not to:
                        </p>
                        <ul>
                            <li>
                                Use our services in any way that violates any
                                applicable law or regulation
                            </li>
                            <li>
                                Transmit any advertising or promotional
                                material, including spam or chain letters
                            </li>
                            <li>Impersonate us, or other users</li>
                            <li>
                                Engage in conduct that restricts or inhibits
                                anyone's use or enjoyment of our services
                            </li>
                            <li>
                                Use any automated device or process to access or
                                copy material from our services
                            </li>
                            <li>
                                Use our services in any manner that could
                                disable, overburden, or impair the site
                            </li>
                            <li>
                                Submitting profiles containing illegitimately
                                acquired achievements or stats
                            </li>
                        </ul>
                    </section>

                    <!-- Section: Intellectual Property Rights -->
                    <section>
                        <h2>Intellectual Property Rights</h2>
                        <p>
                            Our services and all their contents are owned by
                            Steam Vault or its licensors and are protected by
                            intellectual property laws.
                        </p>
                        <p>
                            These Terms allow you to use our services for your
                            personal, non-commercial use only. You must not
                            reproduce, distribute, or create derivative works of
                            any material on our services except as permitted.
                        </p>
                        <ul>
                            <li>
                                Your computer may temporarily store copies of
                                materials incidental to accessing them
                            </li>
                            <li>
                                You may cache files automatically for display
                                enhancement purposes
                            </li>
                            <li>
                                You may print or download one copy of a
                                reasonable number of pages for personal use
                            </li>
                        </ul>
                    </section>

                    <!-- Section: Limitation of Liability -->
                    <section>
                        <h2>Limitation of Liability</h2>
                        <p>
                            In no event will Steam Vault or its affiliates be
                            liable for damages arising out of your use of our
                            services.
                        </p>
                    </section>

                    <!-- Section: Termination -->
                    <section>
                        <h2>Termination</h2>
                        <p>
                            We may suspend or terminate your account
                            immediately, without notice or liability, if you
                            violate these Terms.
                        </p>
                    </section>

                    <!-- Section: Changes to These Terms -->
                    <section>
                        <h2>Changes to These Terms</h2>
                        <p>
                            We reserve the right to modify these Terms at any
                            time. If a revision is material, we will provide at
                            least 30 days' notice prior to the new terms taking
                            effect.
                        </p>
                    </section>
                </div>
            </Tabs.Panel>
        {/snippet}
    </Tabs>

    <!-- Contact Information -->
    <div class="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
        <h2 id="support" class="mb-4 text-xl font-bold">Contact Us</h2>
        <p class="mb-4 text-gray-300">
            If you have any questions about our Privacy Policy or Terms of
            Service, please contact us:
        </p>
        <ul class="space-y-2 text-gray-300">
            <li><strong>Email:</strong> legal@todo.com</li>
        </ul>
    </div>

    <!-- Print and Download Options -->
    <div class="mb-8 flex flex-wrap gap-4">
        <button
            class="btn preset-outlined-surface-500"
            onclick={() => window.print()}
        >
            Print This Page
        </button>
    </div>

    <!-- Acknowledgment -->
    <div class="mb-8 text-center">
        <p class="text-sm text-gray-400">
            By using Steam Vault, you acknowledge that you have read and
            understood our Privacy Policy and Terms of Service, and agree to be
            bound by them.
        </p>
    </div>
</main>
