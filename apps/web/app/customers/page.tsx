'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Eye, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import CustomerForm from '@/components/customers/customer-form';
import ProtectedRoute from '@/components/auth/protected-route';

export default function CustomersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);

  // Fetch customers with filtering
  const { data: customers, isLoading, refetch } = trpc.customers.list.useQuery({
    search: searchTerm || undefined,
    limit: 100,
  });

  // Delete customer mutation
  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Customer deleted successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete customer',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setEditCustomer(null);
    refetch();
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">
              Manage your customer relationships and contact information
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{customers?.length || 0}</p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-2xl font-bold">
                {customers?.filter(c => c.orders.length > 0).length || 0}
              </p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  customers?.reduce((sum, c) => 
                    sum + c.orders.reduce((orderSum, o) => 
                      orderSum + parseFloat(o.grandTotal.toString()), 0
                    ), 0
                  ) || 0
                )}
              </p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg Order Value</p>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  (customers?.reduce((sum, c) => 
                    sum + c.orders.reduce((orderSum, o) => 
                      orderSum + parseFloat(o.grandTotal.toString()), 0
                    ), 0
                  ) || 0) / 
                  (customers?.reduce((count, c) => count + c.orders.length, 0) || 1)
                )}
              </p>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        {/* Customers Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : customers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">No customers found</p>
                  </TableCell>
                </TableRow>
              ) : (
                customers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customer.customerCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {customer.email && (
                          <p className="text-sm">{customer.email}</p>
                        )}
                        {customer.phone && (
                          <p className="text-sm text-muted-foreground">{customer.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.addresses.length > 0 && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="text-sm">
                            {customer.addresses[0].city}, {customer.addresses[0].state}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {customer.orders.length} orders
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        customer.orders.reduce((sum, order) => 
                          sum + parseFloat(order.grandTotal.toString()), 0
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditCustomer(customer)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(customer.id)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
              <DialogDescription>
                Add a new customer to your database
              </DialogDescription>
            </DialogHeader>
            <CustomerForm onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editCustomer} onOpenChange={() => setEditCustomer(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription>
                Update customer information
              </DialogDescription>
            </DialogHeader>
            <CustomerForm 
              customer={editCustomer} 
              onSuccess={handleEditSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}