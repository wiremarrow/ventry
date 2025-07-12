import { useEffect, useState } from 'react';
import { createClient } from '../src/lib/supabase/client';
import { api } from '@/lib/trpc';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface InventoryUpdate {
  id: string;
  itemId: string;
  locationId: string;
  qtyOnHand: number;
  qtyReserved: number;
  updatedAt: string;
}

export function useRealtimeInventory(locationId?: string) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  // Get initial data via tRPC
  const { data: inventory, refetch } = api.inventory.list.useQuery(
    { locationId },
    { enabled: !!locationId }
  );

  useEffect(() => {
    if (!locationId) return;

    const supabase = createClient();
    
    // Subscribe to inventory changes for specific location
    const inventoryChannel = supabase
      .channel(`inventory:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('Inventory update:', payload);
          
          // Refetch data via tRPC to ensure consistency
          refetch();
          
          // Optionally, you could update the cache directly
          // for instant UI updates before the refetch completes
        }
      )
      .subscribe();

    setChannel(inventoryChannel);

    // Cleanup subscription on unmount
    return () => {
      if (inventoryChannel) {
        supabase.removeChannel(inventoryChannel);
      }
    };
  }, [locationId, refetch]);

  return {
    inventory,
    isSubscribed: channel?.state === 'subscribed',
  };
}

// Example usage in a component:
/*
export function InventoryDashboard() {
  const { inventory, isSubscribed } = useRealtimeInventory('location-123');
  
  return (
    <div>
      {isSubscribed && <Badge>Live Updates</Badge>}
      {inventory?.map(item => (
        <InventoryCard key={item.id} {...item} />
      ))}
    </div>
  );
}
*/