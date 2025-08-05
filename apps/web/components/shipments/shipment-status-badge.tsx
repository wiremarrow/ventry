import { Badge } from '@ventry/ui';
import { Clock, Package, Truck, CheckCircle2, RotateCcw } from 'lucide-react';

interface ShipmentStatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export function ShipmentStatusBadge({ status, showIcon = true }: ShipmentStatusBadgeProps) {
  type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
  type IconComponent = typeof Clock;
  const statusConfig: Record<
    string,
    { variant: BadgeVariant; icon: IconComponent; label: string; className?: string }
  > = {
    PENDING: {
      variant: 'secondary' as const,
      icon: Clock,
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    PACKED: {
      variant: 'secondary' as const,
      icon: Package,
      label: 'Packed',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    SHIPPED: {
      variant: 'default' as const,
      icon: Truck,
      label: 'Shipped',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    IN_TRANSIT: {
      variant: 'default' as const,
      icon: Truck,
      label: 'In Transit',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    DELIVERED: {
      variant: 'default' as const,
      icon: CheckCircle2,
      label: 'Delivered',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    RETURNED: {
      variant: 'destructive' as const,
      icon: RotateCcw,
      label: 'Returned',
      className: 'bg-red-100 text-red-800 border-red-300',
    },
  };

  const config = statusConfig[status] || {
    variant: 'outline' as const,
    icon: Package,
    label: status,
    className: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
