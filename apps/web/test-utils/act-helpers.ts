import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, beforeEach, afterEach } from 'vitest';

/**
 * Wrapper for userEvent that automatically wraps interactions in act()
 * This helps prevent act() warnings in tests
 */
export const createUser = () => {
  return userEvent.setup({
    // Ensure all events are properly wrapped in act()
    advanceTimers: () => act(() => Promise.resolve()),
  });
};

/**
 * Enhanced waitFor that ensures proper act() wrapping
 */
export const waitForWithAct = async (
  callback: () => void | Promise<void>,
  options?: Parameters<typeof waitFor>[1]
) => {
  return waitFor(async () => {
    await act(async () => {
      await callback();
    });
  }, options);
};

/**
 * Helper to wait for all pending promises and timers
 * Useful for ensuring all async operations complete
 */
export const waitForPendingPromises = async () => {
  await act(async () => {
    // Flush all pending promises
    await new Promise((resolve) => setImmediate(resolve));
    // Flush all pending timers
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/**
 * Helper to click an element with proper act() wrapping
 */
export const clickElement = async (element: HTMLElement) => {
  const user = createUser();
  await act(async () => {
    await user.click(element);
  });
};

/**
 * Helper to type in an element with proper act() wrapping
 */
export const typeInElement = async (element: HTMLElement, text: string) => {
  const user = createUser();
  await act(async () => {
    await user.type(element, text);
  });
};

/**
 * Helper to clear and type in an element
 */
export const clearAndType = async (element: HTMLElement, text: string) => {
  const user = createUser();
  await act(async () => {
    await user.clear(element);
    await user.type(element, text);
  });
};

/**
 * Helper to select an option from a dropdown
 */
export const selectOption = async (trigger: HTMLElement, optionText: string) => {
  const user = createUser();
  await act(async () => {
    // Click the trigger to open dropdown
    await user.click(trigger);
  });

  // Wait for dropdown to open
  await waitFor(() => {
    const option = document.querySelector(`[role="option"]:has-text("${optionText}")`);
    if (!option) throw new Error(`Option "${optionText}" not found`);
  });

  // Click the option
  const option = document.querySelector(`[role="option"]:has-text("${optionText}")`) as HTMLElement;
  await act(async () => {
    await user.click(option);
  });
};

/**
 * Helper to handle form submission with act()
 */
export const submitForm = async (form: HTMLFormElement) => {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });
};

/**
 * Helper to wait for loading states to complete
 */
export const waitForLoadingToFinish = async () => {
  // Wait for any loading indicators to disappear
  await waitFor(() => {
    const loadingElements = document.querySelectorAll(
      '[data-testid*="loading"], [role="progressbar"], .animate-pulse'
    );
    expect(loadingElements).toHaveLength(0);
  });
};

/**
 * Helper to handle dialog interactions
 */
export const openDialog = async (trigger: HTMLElement) => {
  await clickElement(trigger);
  // Wait for dialog to fully open
  await waitFor(() => {
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
  });
  await waitForPendingPromises();
};

/**
 * Helper to close a dialog
 */
export const closeDialog = async () => {
  const closeButton = document.querySelector('[aria-label="Close"]') as HTMLElement;
  if (closeButton) {
    await clickElement(closeButton);
  } else {
    // Try pressing Escape
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
  }

  // Wait for dialog to close
  await waitFor(() => {
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeInTheDocument();
  });
};

/**
 * Helper to wait for a dialog with specific text to appear
 */
export const waitForDialog = async (dialogText: string) => {
  await waitFor(() => {
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(dialogText);
  });
  await waitForPendingPromises();
};

/**
 * Utility to suppress console errors/warnings during tests
 */
export const suppressConsole = () => {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  return {
    getErrorCalls: () => (console.error as ReturnType<typeof vi.fn>).mock.calls,
    getWarnCalls: () => (console.warn as ReturnType<typeof vi.fn>).mock.calls,
  };
};
