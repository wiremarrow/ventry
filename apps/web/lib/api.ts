import axios from 'axios';
import { API_ENDPOINTS } from '@ventry/shared';
import { useAuthStore } from './auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/api';

console.log('[API Client] Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with cookies
});

api.interceptors.request.use((config) => {
  // Get token from auth store instead of localStorage
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const authState = useAuthStore.getState();
      const refreshToken = authState.refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken, user } = response.data;
          
          // Update auth store with new tokens
          authState.login(user, accessToken, newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (_refreshError) {
          // Clear auth state on refresh failure
          authState.logout();
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;