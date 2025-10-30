import { setBypassCdnEnabled } from "@project/lib";
import * as Sentry from "@sentry/sveltekit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/public";

const clientDsn = env.PUBLIC_SENTRY_DSN;

// Disable Sentry in development mode
if (!dev && clientDsn) {
	Sentry.init({
		// If you don't want to use Session Replay, remove the `Replay` integration,
		// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
		dsn: clientDsn,
		tracesSampleRate: 1,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1,
		integrations: [Sentry.replayIntegration()],
		enableLogs: true,
	});
}

export const init = () => dev && setBypassCdnEnabled(true);

export const handleError = !dev && Sentry.handleErrorWithSentry();
