'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import { z } from 'zod';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@ventry/ui';

import { toast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';

import type { Address, Customer } from '@ventry/database';

const addressSchema = z.object({
  addressType: z.enum(['BILLING', 'SHIPPING', 'BOTH']),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  phone: z.string().optional(),
  attention: z.string().optional(),
  isDefault: z.boolean().default(false),
});

const customerSchema = z.object({
  customerCode: z.string().min(1, 'Customer code is required'),
  companyName: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  currencyId: z.string().default('USD'),
  defaultPaymentTerms: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  addresses: z.array(addressSchema).default([]),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// Type for address form data (similar to Address but with required fields for form)
type AddressFormData = z.infer<typeof addressSchema>;

interface CustomerFormProps {
  customer?: Customer & { addresses?: Address[] };
  onSuccess: () => void;
}

export default function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const [addresses, setAddresses] = useState<AddressFormData[]>(
    customer?.addresses?.map(addr => ({
      addressType: addr.addressType,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone || '',
      attention: addr.attention || '',
      isDefault: addr.isDefault,
    })) || []
  );
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerCode: customer?.customerCode || '',
      companyName: customer?.companyName || '',
      firstName: customer?.firstName || '',
      lastName: customer?.lastName || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      taxId: customer?.taxId || '',
      currencyId: customer?.currencyId || 'USD',
      defaultPaymentTerms: customer?.defaultPaymentTerms || '',
      website: customer?.website || '',
      addresses: [],
    },
  });

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Customer created successfully',
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create customer',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Customer updated successfully',
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update customer',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    // Remove addresses from data as they're handled separately
    const { addresses: _, ...customerData } = data;

    if (customer) {
      updateMutation.mutate({
        id: customer.id,
        ...customerData,
      });
    } else {
      createMutation.mutate(customerData);
    }
  };

  const addAddress = () => {
    const newAddress: AddressFormData = {
      addressType: 'BOTH',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      phone: '',
      attention: '',
      isDefault: addresses.length === 0,
    };
    setAddresses([...addresses, newAddress]);
  };

  const updateAddress = <K extends keyof AddressFormData>(
    index: number, 
    field: K, 
    value: AddressFormData[K]
  ) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [field]: value };
    setAddresses(updated);
  };

  const removeAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Information</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerCode">Customer Code *</Label>
              <Input
                id="customerCode"
                {...register('customerCode')}
                placeholder="CUST001"
              />
              {errors.customerCode && (
                <p className="text-sm text-destructive mt-1">{errors.customerCode.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                {...register('companyName')}
                placeholder="Acme Corporation"
              />
            </div>

            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                {...register('firstName')}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                {...register('lastName')}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                {...register('taxId')}
                placeholder="12-3456789"
              />
            </div>

            <div>
              <Label htmlFor="currencyId">Currency</Label>
              <Select
                value={watch('currencyId')}
                onValueChange={(value) => setValue('currencyId', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="defaultPaymentTerms">Default Payment Terms</Label>
              <Input
                id="defaultPaymentTerms"
                {...register('defaultPaymentTerms')}
                placeholder="Net 30"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                {...register('website')}
                placeholder="https://example.com"
              />
              {errors.website && (
                <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Addresses</Label>
            <Button type="button" variant="outline" size="sm" onClick={addAddress}>
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </div>

          {addresses.map((address, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Address Type</Label>
                      <Select
                        value={address.addressType}
                        onValueChange={(value) => updateAddress(index, 'addressType', value as 'BILLING' | 'SHIPPING' | 'BOTH')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BILLING">Billing</SelectItem>
                          <SelectItem value="SHIPPING">Shipping</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label>Address Line 1</Label>
                      <Input
                        value={address.line1}
                        onChange={(e) => updateAddress(index, 'line1', e.target.value)}
                        placeholder="123 Main Street"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={address.line2}
                        onChange={(e) => updateAddress(index, 'line2', e.target.value)}
                        placeholder="Suite 100"
                      />
                    </div>

                    <div>
                      <Label>City</Label>
                      <Input
                        value={address.city}
                        onChange={(e) => updateAddress(index, 'city', e.target.value)}
                        placeholder="New York"
                        required
                      />
                    </div>

                    <div>
                      <Label>State</Label>
                      <Input
                        value={address.state}
                        onChange={(e) => updateAddress(index, 'state', e.target.value)}
                        placeholder="NY"
                        required
                      />
                    </div>

                    <div>
                      <Label>Postal Code</Label>
                      <Input
                        value={address.postalCode}
                        onChange={(e) => updateAddress(index, 'postalCode', e.target.value)}
                        placeholder="10001"
                        required
                      />
                    </div>

                    <div>
                      <Label>Country</Label>
                      <Input
                        value={address.country}
                        onChange={(e) => updateAddress(index, 'country', e.target.value)}
                        placeholder="United States"
                        required
                      />
                    </div>

                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={address.phone}
                        onChange={(e) => updateAddress(index, 'phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <Label>Attention</Label>
                      <Input
                        value={address.attention}
                        onChange={(e) => updateAddress(index, 'attention', e.target.value)}
                        placeholder="Receiving Department"
                      />
                    </div>

                    <div className="col-span-2 flex items-center space-x-2">
                      <Switch
                        checked={address.isDefault}
                        onCheckedChange={(checked) => updateAddress(index, 'isDefault', checked)}
                      />
                      <Label>Default Address</Label>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAddress(index)}
                    className="ml-4"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {addresses.length === 0 && (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">
                No addresses added yet. Click "Add Address" to create one.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}