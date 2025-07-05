'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginRequest } from '@ventry/shared';
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@ventry/ui';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import { API_ENDPOINTS } from '@ventry/shared';
import { logApiError, componentLog } from '@/lib/debug';
import * as Sentry from '@sentry/nextjs';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true);
    setError('');
    componentLog('LoginForm', 'Attempting login with:', data.email);

    // Add Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'User attempting login',
      level: 'info',
      data: { email: data.email },
    });

    try {
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, data);
      const { user, accessToken, refreshToken } = response.data;
      
      componentLog('LoginForm', 'Login successful:', user);
      
      // Set Sentry user context
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.email,
      });

      login(user, accessToken, refreshToken);
      
      // Add success breadcrumb
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Login successful',
        level: 'info',
      });
      
      // Small delay to ensure cookie is set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use Next.js router for navigation
      console.log('[LoginForm] Navigating to dashboard...');
      router.push('/dashboard');
    } catch (err: unknown) {
      logApiError(API_ENDPOINTS.AUTH.LOGIN, err);
      
      // Capture the error in Sentry
      Sentry.captureException(err, {
        tags: {
          component: 'LoginForm',
          action: 'login',
        },
        extra: {
          email: data.email,
          endpoint: API_ENDPOINTS.AUTH.LOGIN,
        },
      });

      const errorMessage = 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 
        'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Sign In to Ventry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center text-sm text-gray-600">
        <div className="w-full">
          <p>Demo accounts:</p>
          <p>Admin: admin@ventry.com / admin123</p>
          <p>Manager: manager@ventry.com / manager123</p>
          <p>User: user@ventry.com / user123</p>
        </div>
      </CardFooter>
    </Card>
  );
}