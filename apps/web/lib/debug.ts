import { useEffect, useRef } from 'react';

/**
 * Enhanced debugging utilities for development
 */

export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Enhanced console.log that only runs in development
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log('[DEV]', ...args);
  }
};

/**
 * Log with component name for better tracking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentLog = (componentName: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(`[${componentName}]`, ...args);
  }
};

/**
 * Track renders and why component re-rendered
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWhyDidYouUpdate = (name: string, props: Record<string, any>) => {
  if (!isDevelopment) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previousProps = useRef<Record<string, any> | undefined>(undefined);

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changedProps: Record<string, any> = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length) {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
};

/**
 * Log API errors with context
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logApiError = (endpoint: string, error: any) => {
  if (isDevelopment) {
    console.error(`[API Error] ${endpoint}:`, {
      message: error?.response?.data?.message || error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      fullError: error,
    });
  }
};

/**
 * Performance tracking
 */
export const measurePerformance = async <T,>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  if (!isDevelopment) return fn();

  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    console.error(`[Performance] ${name} failed after ${(end - start).toFixed(2)}ms`);
    throw error;
  }
};