'use client';

import { useState } from 'react';
import { Card, Input, Button, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { Search, MoreHorizontal, Edit, UserCheck, UserX, Users as UsersIcon, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserDialog } from '@/components/users/user-dialog';
import { UserStatusBadge } from '@/components/users/user-status-badge';
import { UserRoleBadge } from '@/components/users/user-role-badge';
import { formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { useOrganization } from '@/hooks/use-organization';
import { toast } from '@/hooks/use-toast';

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user: currentUser } = useAuthStore();
  const { currentOrganization } = useOrganization();
  
  // Check if user is organization admin (OWNER or ADMIN role in the organization)
  const isOrgAdmin = currentOrganization && ['OWNER', 'ADMIN'].includes(currentOrganization.role);

  // Fetch users
  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();

  // Mutations
  const activateMutation = trpc.users.activate.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User activated successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate user',
        variant: 'destructive',
      });
    },
  });

  const deactivateMutation = trpc.users.deactivate.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User deactivated successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate user',
        variant: 'destructive',
      });
    },
  });

  // Filter users by search term
  const filteredUsers = users?.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(search) ||
      user.username.toLowerCase().includes(search) ||
      user.firstName.toLowerCase().includes(search) ||
      user.lastName.toLowerCase().includes(search)
    );
  }) || [];

  // Calculate stats
  const stats = {
    total: users?.length || 0,
    active: users?.filter(u => u.isActive).length || 0,
    inactive: users?.filter(u => !u.isActive).length || 0,
  };

  const handleEdit = (userId: string) => {
    setSelectedUser(userId);
    setIsDialogOpen(true);
  };

  const handleActivate = (userId: string) => {
    if (confirm('Are you sure you want to activate this user?')) {
      activateMutation.mutate({ id: userId });
    }
  };

  const handleDeactivate = (userId: string) => {
    if (confirm('Are you sure you want to deactivate this user?')) {
      deactivateMutation.mutate({ id: userId });
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Organization Users</h1>
              <p className="text-muted-foreground">
                Manage users in your organization
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <UsersIcon className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Inactive Users</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </Card>
          </div>

          {/* Search */}
          <Card className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Users Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? 'No users found matching your search' 
                          : 'No users found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.username}
                      </TableCell>
                      <TableCell>
                        <UserRoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        <UserStatusBadge isActive={user.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastLoginAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span className="text-sm">
                              {formatDateTime(user.lastLoginAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm">Never</span>
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
                            <DropdownMenuItem onClick={() => handleEdit(user.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {isOrgAdmin && user.id !== currentUser?.id && (
                              <>
                                {user.isActive ? (
                                  <DropdownMenuItem 
                                    onClick={() => handleDeactivate(user.id)}
                                    className="text-red-600"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem 
                                    onClick={() => handleActivate(user.id)}
                                    className="text-green-600"
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* User Dialog */}
          <UserDialog
            userId={selectedUser}
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setSelectedUser(null);
              }
            }}
            onSuccess={() => {
              setIsDialogOpen(false);
              setSelectedUser(null);
              refetch();
            }}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}