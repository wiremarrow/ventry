import { PrismaClient } from '@ventry/database';
import { getSupabaseServiceClient, shouldUseSupabase } from '../config/supabase.js';

export class SupabaseSyncService {
  private prisma: PrismaClient;
  private supabase: ReturnType<typeof getSupabaseServiceClient>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.supabase = getSupabaseServiceClient();
  }

  // Sync a single user to Supabase
  async syncUser(userId: string) {
    if (!shouldUseSupabase('write')) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !this.supabase) return;

    const { error } = await this.supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
        last_login_at: user.lastLoginAt?.toISOString() || null,
        organization_id: null, // Will be set during full migration
      });

    if (error) {
      console.error('Failed to sync user to Supabase:', error);
    }
  }

  // Sync items to Supabase items
  async syncItem(itemId: string) {
    if (!shouldUseSupabase('write')) return;

    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        category: true,
        inventory: true,
      },
    });

    if (!item || !this.supabase) return;

    // First ensure category exists in Supabase
    const { data: category } = await this.supabase
      .from('item_categories')
      .select('id')
      .eq('name', item.category?.name || 'Uncategorized')
      .single();

    let categoryId = category?.id;

    if (!categoryId) {
      // Create category if it doesn't exist
      const { data: newCategory, error: catError } = await this.supabase
        .from('item_categories')
        .insert({
          name: item.category?.name || 'Uncategorized',
          description: item.category?.description,
          organization_id: await this.getDefaultOrganizationId(),
        })
        .select()
        .single();

      if (catError) {
        console.error('Failed to create category in Supabase:', catError);
        return;
      }

      categoryId = newCategory.id;
    }

    // Get or create default UOM
    const { data: uom } = await this.supabase
      .from('units_of_measure')
      .select('id')
      .eq('code', 'EA')
      .single();

    let uomId = uom?.id;

    if (!uomId) {
      const { data: newUom } = await this.supabase
        .from('units_of_measure')
        .insert({
          code: 'EA',
          description: 'Each',
          is_base: true,
        })
        .select()
        .single();

      uomId = newUom?.id;
    }

    // Sync item as item
    const { error: itemError } = await this.supabase
      .from('items')
      .upsert({
        id: item.id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        category_id: categoryId,
        uom_id: uomId,
        default_cost: item.defaultCost || null,
        default_price: item.defaultPrice || null,
        is_active: item.isActive,
        organization_id: await this.getDefaultOrganizationId(),
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      });

    if (itemError) {
      console.error('Failed to sync item to Supabase:', itemError);
      return;
    }

    // Sync inventory
    for (const inv of item.inventory) {
      await this.syncInventory(inv.id);
    }
  }

  // Sync inventory items
  async syncInventory(inventoryId: string) {
    if (!shouldUseSupabase('write')) return;

    const inventory = await this.prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        location: true,
      },
    });

    if (!inventory || !this.supabase) return;

    // Ensure location exists
    const locationId = await this.ensureLocation(inventory.location);

    const { error } = await this.supabase
      .from('inventory')
      .upsert({
        item_id: inventory.itemId,
        location_id: locationId,
        qty_on_hand: inventory.qtyOnHand,
        qty_reserved: 0,
        qty_in_transit: 0,
        organization_id: await this.getDefaultOrganizationId(),
        updated_at: inventory.updatedAt.toISOString(),
      });

    if (error) {
      console.error('Failed to sync inventory to Supabase:', error);
    }
  }

  // Helper to ensure location exists in Supabase
  private async ensureLocation(location: any): Promise<string> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    const { data: existing } = await this.supabase
      .from('locations')
      .select('id')
      .eq('code', location.name)
      .single();

    if (existing) return existing.id;

    // Create warehouse first
    const { data: warehouse } = await this.supabase
      .from('warehouses')
      .insert({
        code: 'DEFAULT',
        name: 'Default Warehouse',
        line1: location.address || '123 Main St',
        city: 'City',
        state: 'State',
        postal_code: '12345',
        country: 'USA',
        organization_id: await this.getDefaultOrganizationId(),
      })
      .select()
      .single();

    const { data: newLocation } = await this.supabase
      .from('locations')
      .insert({
        warehouse_id: warehouse?.id,
        code: location.name,
        description: location.description,
        organization_id: await this.getDefaultOrganizationId(),
      })
      .select()
      .single();

    return newLocation?.id || '';
  }

  // Get or create default organization
  private async getDefaultOrganizationId(): Promise<string> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    const { data: existing } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('slug', 'default')
      .single();

    if (existing) return existing.id;

    const { data: newOrg } = await this.supabase
      .from('organizations')
      .insert({
        name: 'Default Organization',
        slug: 'default',
        plan: 'free',
      })
      .select()
      .single();

    return newOrg?.id || '';
  }

  // Bulk sync all data
  async syncAllData() {
    if (!shouldUseSupabase('write')) {
      console.log('Supabase sync is disabled');
      return;
    }

    console.log('Starting Supabase data sync...');

    // Sync users
    const users = await this.prisma.user.findMany();
    for (const user of users) {
      await this.syncUser(user.id);
    }
    console.log(`Synced ${users.length} users`);

    // Sync items
    const items = await this.prisma.item.findMany();
    for (const item of items) {
      await this.syncItem(item.id);
    }
    console.log(`Synced ${items.length} items`);

    console.log('Supabase data sync completed');
  }
}