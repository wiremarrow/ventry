'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  UserPlus, 
  MoreVertical,
  Mail,
  Shield,
  AlertCircle,
  Trash2,
  Edit,
  Copy,
  CheckCircle
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/use-organization';
import ProtectedRoute from '@/components/auth/protected-route';

const roleLabels = {
  OWNER: { label: 'Owner', color: 'destructive' },
  ADMIN: { label: 'Admin', color: 'default' },
  MEMBER: { label: 'Member', color: 'secondary' },
  VIEWER: { label: 'Viewer', color: 'outline' },
} as const;

export default function OrganizationMembersPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  const { data: members, isLoading, refetch } = trpc.organizations.getMembers.useQuery(
    { organizationId: currentOrganization?.id || '' },
    { enabled: !!currentOrganization?.id }
  );

  const { data: organization } = trpc.organizations.get.useQuery(
    { id: currentOrganization?.id || '' },
    { enabled: !!currentOrganization?.id }
  );

  const inviteMutation = trpc.organizations.inviteUser.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invitation sent successfully',
      });
      setInviteEmail('');
      setInviteRole('MEMBER');
      setIsInviteDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = trpc.organizations.updateUserRole.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Role updated successfully',
      });
      setIsEditDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  const removeMemberMutation = trpc.organizations.removeUser.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Member removed successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });

  const handleInvite = () => {
    if (!currentOrganization?.id || !inviteEmail) return;

    inviteMutation.mutate({
      organizationId: currentOrganization.id,
      email: inviteEmail,
      role: inviteRole,
    });
  };

  const handleUpdateRole = () => {
    if (!currentOrganization?.id || !selectedMember) return;

    updateRoleMutation.mutate({
      organizationId: currentOrganization.id,
      userId: selectedMember.userId,
      role: editRole,
    });
  };

  const handleRemoveMember = (member: any) => {
    if (!currentOrganization?.id) return;

    if (confirm(`Are you sure you want to remove ${member.user.name || member.user.email} from the organization?`)) {
      removeMemberMutation.mutate({
        organizationId: currentOrganization.id,
        userId: member.userId,
      });
    }
  };

  const copyInviteLink = (inviteToken: string) => {
    const inviteUrl = `${window.location.origin}/invite/${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Copied',
      description: 'Invite link copied to clipboard',
    });
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ProtectedRoute>
    );
  }

  const isOwnerOrAdmin = organization && ['OWNER', 'ADMIN'].includes(organization.role);
  const isOwner = organization?.role === 'OWNER';

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Members</h1>
            <p className="text-muted-foreground">
              Manage your organization's team members and their permissions
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Admins can manage settings and members
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleInvite} 
                    disabled={!inviteEmail || inviteMutation.isLoading}
                  >
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                {isOwnerOrAdmin && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{member.user.name || member.user.email}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleLabels[member.role].color as any}>
                      <Shield className="h-3 w-3 mr-1" />
                      {roleLabels[member.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.inviteToken ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Mail className="h-3 w-3 mr-1" />
                          Invited
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(member.inviteToken!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {isOwnerOrAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role !== 'OWNER' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditRole(member.role as any);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              {isOwner && (
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Member Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedMember?.user.name || selectedMember?.user.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-role">New Role</Label>
                <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateRole} 
                disabled={updateRoleMutation.isLoading}
              >
                Update Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="p-6 bg-muted/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-medium">Role Permissions</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><strong>Owner:</strong> Full access to all organization features and settings</p>
                <p><strong>Admin:</strong> Can manage team members, settings, and all resources</p>
                <p><strong>Member:</strong> Can create and manage inventory, orders, and reports</p>
                <p><strong>Viewer:</strong> Read-only access to organization data</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </ProtectedRoute>
  );
}