import { Badge } from '@ventry/ui';
import { Shield, UserCog, User, HardHat, Warehouse, ShoppingCart } from 'lucide-react';
import type { Role } from '@ventry/database';

interface UserRoleBadgeProps {
  role: Role;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const config = {
    ADMIN: {
      icon: Shield,
      label: 'Admin',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    MANAGER: {
      icon: UserCog,
      label: 'Manager',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    EMPLOYEE: {
      icon: HardHat,
      label: 'Employee',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    USER: {
      icon: User,
      label: 'User',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    WAREHOUSE: {
      icon: Warehouse,
      label: 'Warehouse',
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    },
    SALES: {
      icon: ShoppingCart,
      label: 'Sales',
      className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    },
  };

  const { icon: Icon, label, className } = config[role] || config.USER;

  return (
    <Badge variant="default" className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
