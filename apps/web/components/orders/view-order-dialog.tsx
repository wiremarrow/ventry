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

import type { Order, OrderItem } from '@ventry/database';

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

  const calculateSubtotal = () => {
    return order.items?.reduce((sum: number, item: OrderItem) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0) || 0;
  };

  const calculateDiscount = () => {
    return order.items?.reduce((sum: number, item: OrderItem) => {
      const lineTotal = item.quantity * item.unitPrice;
      return sum + (lineTotal * (item.discountPercentage / 100));
    }, 0) || 0;
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

          {/* Customer Information */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{order.customer?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{order.customer?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{order.customer?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Type</p>
                <p className="font-medium capitalize">{order.customer?.type.toLowerCase()}</p>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Addresses
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Shipping Address</p>
                <p className="text-sm whitespace-pre-line">{order.shippingAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Billing Address</p>
                <p className="text-sm whitespace-pre-line">{order.billingAddress}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items
            </h3>
            <div className="space-y-2">
              {order.items?.map((item: OrderItem) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.item?.name}</p>
                    <p className="text-sm text-gray-600">
                      SKU: {item.item?.sku} • From: {item.warehouse?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                    {item.discountPercentage > 0 && (
                      <p className="text-sm text-gray-600">-{item.discountPercentage}% discount</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Order Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="text-red-600">-{formatCurrency(calculateDiscount())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span>{formatCurrency(order.taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span>{formatCurrency(order.shippingAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'secondary'}>
                  {order.paymentStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium">{order.paymentMethod || '-'}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex gap-2">
            <Button variant="outline" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Generate Invoice
            </Button>
            <Button variant="outline" className="flex-1">
              <Truck className="h-4 w-4 mr-2" />
              Create Shipment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}