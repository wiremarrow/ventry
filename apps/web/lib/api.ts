import axios from 'axios';
import { useAuthStore } from './auth-store';

// Legacy REST API client - DEPRECATED
// Use tRPC for new functionality
// This exists only for components that haven't been migrated to tRPC yet

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/api';

console.log('[API Client] Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with cookies
});

// No longer need to add Authorization headers - using httpOnly cookies

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // For 401 errors, just logout and redirect
    // No token refresh since we're moving to tRPC
    if (error.response?.status === 401) {
      const authState = useAuthStore.getState();
      authState.logout();

      // Only redirect if not already on login page
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
