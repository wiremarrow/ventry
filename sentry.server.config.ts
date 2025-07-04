// This file configures the initialization of Sentry on the server side.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Capture unhandled promise rejections
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Undici({
      allowedUrls: [/.*/],
      tracePropagationTargets: ['localhost', /^\//],
    }),
  ],

  // Set environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  beforeSend(event, hint) {
    // Filter out events in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Event:', event, hint);
      return null;
    }

    // Don't send events for health checks
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }

    return event;
  },
});