import { createBrowserClient, createServiceClient } from './client.js';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface SupabaseAuthUser extends SupabaseUser {
  user_metadata: {
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: 'ADMIN' | 'MANAGER' | 'USER' | 'WAREHOUSE' | 'SALES';
    organizationId?: string;
  };
}

export class SupabaseAuthService {
  private client;

  constructor(isServer = false) {
    this.client = isServer ? createServiceClient() : createBrowserClient();
  }

  async signUp(
    email: string,
    password: string,
    metadata: {
      username: string;
      firstName: string;
      lastName: string;
      role?: string;
      organizationId?: string;
    }
  ) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async getUser() {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();
    if (error) throw error;
    return user as SupabaseAuthUser | null;
  }

  async refreshSession() {
    const {
      data: { session },
      error,
    } = await this.client.auth.refreshSession();
    if (error) throw error;
    return session;
  }

  // Helper to sync with existing JWT system during migration
  async syncWithJWT(jwtUserId: string) {
    const { data: user } = await this.client.from('users').select('*').eq('id', jwtUserId).single();

    return user;
  }

  // Social auth providers
  async signInWithGoogle() {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  }

  async signInWithGitHub() {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  }

  // Session management
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.client.auth.onAuthStateChange(callback);
  }
}
