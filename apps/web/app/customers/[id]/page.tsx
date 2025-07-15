'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ventry/ui';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Globe, 
  DollarSign,
  Calendar,
  Edit,
  FileText
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { data: customer, isLoading } = trpc.customers.get.useQuery(
    { id: customerId },
    { enabled: !!customerId }
  );

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!customer) {
    return (
      <ProtectedRoute>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Customer not found</p>
          <Button 
            variant="link" 
            onClick={() => router.push('/customers')}
            className="mt-4"
          >
            Back to Customers
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const totalSpent = customer.orders.reduce((sum, order) => 
    sum + parseFloat(order.grandTotal.toString()), 0
  );

  const averageOrderValue = totalSpent / (customer.orders.length || 1);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/customers')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {customer.companyName || `${customer.firstName} ${customer.lastName}`}
              </h1>
              <p className="text-muted-foreground">{customer.customerCode}</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/customers/${customerId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>

        {/* Customer Info Card */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Contact Information</h3>
              <div className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${customer.email}`} className="text-sm hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${customer.phone}`} className="text-sm hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {customer.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={customer.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                    >
                      {customer.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Business Information</h3>
              <div className="space-y-3">
                {customer.taxId && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Tax ID: {customer.taxId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Currency: {customer.currencyId}</span>
                </div>
                {customer.defaultPaymentTerms && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Payment Terms: {customer.defaultPaymentTerms}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="space-y-4">
              <h3 className="font-semibold">Customer Summary</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{customer.orders.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-xl font-semibold">{formatCurrency(totalSpent)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Order Value</p>
                  <p className="text-xl font-semibold">{formatCurrency(averageOrderValue)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs for Additional Information */}
        <Tabs defaultValue="addresses" className="w-full">
          <TabsList>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>

          <TabsContent value="addresses">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.addresses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <p className="text-muted-foreground">No addresses on file</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.addresses.map((address) => (
                      <TableRow key={address.id}>
                        <TableCell>
                          <Badge variant="outline">{address.addressType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{address.line1}</p>
                            {address.line2 && <p className="text-sm">{address.line2}</p>}
                            <p className="text-sm text-muted-foreground">
                              {address.city}, {address.state} {address.postalCode}
                            </p>
                            <p className="text-sm text-muted-foreground">{address.country}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {address.attention && (
                              <p className="text-sm">Attn: {address.attention}</p>
                            )}
                            {address.phone && (
                              <p className="text-sm text-muted-foreground">{address.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {address.isDefault && (
                            <Badge variant="default">Default</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">No orders yet</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>{formatDate(order.orderDate)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              order.status === 'DELIVERED' ? 'default' :
                              order.status === 'SHIPPED' ? 'secondary' :
                              order.status === 'CANCELLED' ? 'destructive' :
                              'outline'
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatCurrency(parseFloat(order.grandTotal.toString()))}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="returns">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Refund Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.returns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">No returns</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.returns.map((return_) => (
                      <TableRow key={return_.id}>
                        <TableCell className="font-medium">
                          {return_.returnNumber}
                        </TableCell>
                        <TableCell>{formatDate(return_.returnDate)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              return_.status === 'REFUNDED' ? 'default' :
                              return_.status === 'REJECTED' ? 'destructive' :
                              'outline'
                            }
                          >
                            {return_.status}
                          </Badge>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatCurrency(0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}