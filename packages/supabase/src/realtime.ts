import { createBrowserClient } from './client.js';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type InventoryChangePayload = RealtimePostgresChangesPayload<{
  [key: string]: any;
}>;

export class SupabaseRealtimeService {
  private client;
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor() {
    this.client = createBrowserClient();
  }

  // Subscribe to inventory changes for a specific item
  subscribeToItemInventory(
    itemId: string,
    organizationId: string,
    callback: (payload: InventoryChangePayload) => void
  ) {
    const channelName = `inventory:${organizationId}:${itemId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `item_id=eq.${itemId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_movements',
          filter: `item_id=eq.${itemId}`,
        },
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to all inventory changes for an organization
  subscribeToOrganizationInventory(
    organizationId: string,
    callback: (payload: InventoryChangePayload) => void
  ) {
    const channelName = `inventory:${organizationId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `organization_id=eq.${organizationId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_movements',
          filter: `organization_id=eq.${organizationId}`,
        },
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to low stock alerts
  subscribeToLowStockAlerts(
    organizationId: string,
    callback: (payload: InventoryChangePayload) => void
  ) {
    const channelName = `alerts:${organizationId}:low-stock`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          // Check if stock went below reorder point
          const newRecord = payload.new as any;
          if (newRecord.qty_on_hand <= newRecord.reorder_point) {
            callback(payload);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to new orders
  subscribeToNewOrders(
    organizationId: string,
    callback: (payload: InventoryChangePayload) => void
  ) {
    const channelName = `orders:${organizationId}:new`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `organization_id=eq.${organizationId}`,
        },
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Unsubscribe from a channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }

  // Broadcast custom events
  async broadcast(channel: string, event: string, payload: any) {
    return this.client.channel(channel).send({
      type: 'broadcast',
      event,
      payload,
    });
  }
}