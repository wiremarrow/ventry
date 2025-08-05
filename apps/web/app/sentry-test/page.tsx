'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@ventry/ui';

export default function SentryTestPage() {
  const [isLoading, setIsLoading] = useState(false);

  const testSentryError = () => {
    setIsLoading(true);

    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'User clicked test error button',
      level: 'info',
    });

    // Capture a test error
    try {
      throw new Error('This is a test error from Ventry to verify Sentry integration!');
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          test: true,
          component: 'SentryTestPage',
        },
        extra: {
          message: 'This is intentional - testing Sentry integration',
          timestamp: new Date().toISOString(),
        },
      });

      console.error('Test error sent to Sentry:', error);
      alert('Test error sent to Sentry! Check your Sentry dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  const testSentryMessage = () => {
    // Send a test message
    Sentry.captureMessage('Test message from Ventry', 'info');
    alert('Test message sent to Sentry!');
  };

  const testAuthError = () => {
    // Simulate an auth error
    Sentry.captureException(new Error('Simulated authentication error'), {
      tags: {
        component: 'auth',
        test: true,
      },
      extra: {
        scenario: 'Testing auth error tracking',
        endpoint: '/api/auth/login',
      },
    });
    alert('Auth error sent to Sentry!');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Sentry Integration Test</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <p className="mb-6 text-gray-600">
          Use these buttons to test Sentry error tracking. Check your Sentry dashboard after
          clicking.
        </p>

        <div className="space-y-4">
          <div>
            <Button onClick={testSentryError} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? 'Sending...' : 'Send Test Error'}
            </Button>
            <p className="text-sm text-gray-500 mt-2">Throws and captures a test error</p>
          </div>

          <div>
            <Button onClick={testSentryMessage} variant="outline" className="w-full sm:w-auto">
              Send Test Message
            </Button>
            <p className="text-sm text-gray-500 mt-2">Sends an info message to Sentry</p>
          </div>

          <div>
            <Button onClick={testAuthError} variant="outline" className="w-full sm:w-auto">
              Simulate Auth Error
            </Button>
            <p className="text-sm text-gray-500 mt-2">Simulates an authentication error</p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded">
          <h3 className="font-semibold text-blue-900 mb-2">Sentry Dashboard</h3>
          <p className="text-sm text-blue-700">
            After clicking any button above, check your Sentry dashboard at:
          </p>
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm"
          >
            https://sentry.io
          </a>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold text-gray-900 mb-2">Current Configuration</h3>
          <dl className="text-sm space-y-1">
            <div>
              <dt className="inline font-medium text-gray-600">Environment:</dt>
              <dd className="inline ml-2">{process.env.NODE_ENV}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-gray-600">DSN Configured:</dt>
              <dd className="inline ml-2">{process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
