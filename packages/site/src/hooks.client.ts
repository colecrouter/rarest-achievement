import { setBypassCdnEnabled } from "@project/lib";
import * as Sentry from "@sentry/sveltekit";
import { dev } from "$app/environment";

// Disable Sentry in development mode
if (!dev) {
	Sentry.init({
		// If you don't want to use Session Replay, remove the `Replay` integration,
		// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
		dsn: "https://1090e526411b74ec7e519ecf548c54b5@o4508581503172608.ingest.us.sentry.io/4509233074667520",
		tracesSampleRate: 1,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1,
		integrations: [Sentry.replayIntegration()],
		enableLogs: true,
	});
}

export const init = () => dev && setBypassCdnEnabled(true);

export const handleError = !dev && Sentry.handleErrorWithSentry();
