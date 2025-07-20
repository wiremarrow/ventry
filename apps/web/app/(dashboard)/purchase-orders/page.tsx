'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@ventry/ui/button';

import { CreatePurchaseOrderDialog } from '@/components/purchase-orders/create-purchase-order-dialog';
import { PurchaseOrderFilters } from '@/components/purchase-orders/purchase-order-filters';
import { PurchaseOrderList } from '@/components/purchase-orders/purchase-order-list';
import { PurchaseOrderStats } from '@/components/purchase-orders/purchase-order-stats';
import { useOrganizationStore } from '@/stores/organization';

export default function PurchaseOrdersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { organization } = useOrganizationStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-gray-500">
            Manage purchase orders and track supplier deliveries
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Purchase Order
        </Button>
      </div>

      <PurchaseOrderStats />
      
      <div className="space-y-4">
        <PurchaseOrderFilters />
        <PurchaseOrderList />
      </div>

      <CreatePurchaseOrderDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}