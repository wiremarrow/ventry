'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@ventry/ui';
import { useAuthStore } from '@/lib/auth-store';
import { trpc } from '@/lib/trpc';
import * as Sentry from '@sentry/nextjs';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginRequest = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const [error, setError] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();
  const login = useAuthStore((state) => state.login);


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange', // Show errors as user types
  });


  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      const { user } = data;
      
      // Set Sentry user context
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // Login with user info only - tokens handled by httpOnly cookies
      login(user);
      
      // Invalidate auth.me query to refetch with new authentication
      queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
      
      // Add success breadcrumb
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Login successful',
        level: 'info',
      });
      
      // Navigate to dashboard
      router.push('/dashboard');
    },
    onError: (error) => {
      // Capture the error in Sentry
      Sentry.captureException(error, {
        tags: {
          component: 'LoginForm',
          action: 'login',
        },
      });

      setError(error.message || 'Login failed. Please check your credentials and try again.');
    },
  });

  const onSubmit = async (data: LoginRequest, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    setError('');

    // Add Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'User attempting login',
      level: 'info',
      data: { email: data.email },
    });

    loginMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Sign In to Ventry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              disabled={loginMutation.isPending}
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
              disabled={loginMutation.isPending}
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
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