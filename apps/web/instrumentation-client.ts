// This file configures the initialization of Sentry on the client side.
// It runs before your application starts on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

console.log('[Sentry Client] Initializing from instrumentation-client.ts');
console.log('[Sentry Client] DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production.
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Set environment
  environment: process.env.NODE_ENV || 'development',

  // Additional options
  beforeSend(event, hint) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Sentry Client] Event:', event);
      console.error('[Sentry Client] Hint:', hint);
    }
    return event;
  },
});

console.log('[Sentry Client] Initialization complete');