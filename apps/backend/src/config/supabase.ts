// TODO: Enable after Supabase migration
// import { createServiceClient } from '@ventry/supabase';

export interface SupabaseConfig {
  enabled: boolean;
  migrationMode: 'dual' | 'supabase-only' | 'legacy-only';
  useSupabaseAuth: boolean;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  return {
    enabled: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    migrationMode: (process.env.MIGRATION_MODE as any) || 'legacy-only',
    useSupabaseAuth: process.env.USE_SUPABASE_AUTH === 'true',
  };
};

// Helper to check if Supabase operations should be performed
export const shouldUseSupabase = (operation: 'read' | 'write'): boolean => {
  const config = getSupabaseConfig();
  
  if (!config.enabled) return false;
  
  switch (config.migrationMode) {
    case 'dual':
      return true;
    case 'supabase-only':
      return true;
    case 'legacy-only':
      return false;
    default:
      return false;
  }
};

// Create a Supabase client for backend operations
let supabaseClient: any | null = null;

export const getSupabaseServiceClient = () => {
  if (!supabaseClient && getSupabaseConfig().enabled) {
    try {
      // TODO: Enable after Supabase migration
      // supabaseClient = createServiceClient();
      console.warn('Supabase client not yet implemented');
    } catch (error) {
      console.warn('Failed to create Supabase client:', error);
    }
  }
  return supabaseClient;
};