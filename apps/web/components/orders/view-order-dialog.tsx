'use client';

import { CreditCard, FileText, MapPin, Package, Truck, User } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ventry/ui';

import type { Order } from '@ventry/database';

interface ViewOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewOrderDialog({ order, open, onOpenChange }: ViewOrderDialogProps) {
  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'secondary',
      PENDING: 'warning',
      CONFIRMED: 'info',
      PROCESSING: 'info',
      PACKED: 'info',
      SHIPPED: 'success',
      DELIVERED: 'success',
      CANCELLED: 'destructive',
      REFUNDED: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Order details and history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant={getStatusColor(order.status) as 'default' | 'secondary' | 'destructive' | 'warning'} className="mt-1">
                {order.status}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Order Date</p>
              <p className="font-medium">{formatDate(order.orderDate)}</p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Order Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal ? Number(order.subtotal) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatCurrency(order.discountTotal ? Number(order.discountTotal) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(order.taxTotal ? Number(order.taxTotal) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{formatCurrency(order.shippingTotal ? Number(order.shippingTotal) : 0)}</span>
              </div>
              <div className="border-t pt-2 font-medium">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>{formatCurrency(order.grandTotal ? Number(order.grandTotal) : 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}