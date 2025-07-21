import { Badge } from '@ventry/ui';
import { TrendingUp, TrendingDown, ArrowRight, RotateCcw, AlertTriangle, XCircle } from 'lucide-react';

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'LOSS';

interface MovementTypeBadgeProps {
  type: MovementType;
  showIcon?: boolean;
}

export function MovementTypeBadge({ type, showIcon = true }: MovementTypeBadgeProps) {
  const config: Record<MovementType, { variant: any; icon: any; label: string; className?: string }> = {
    INBOUND: { 
      variant: 'default', 
      icon: TrendingUp, 
      label: 'Inbound',
      className: 'bg-green-100 text-green-800 hover:bg-green-100' 
    },
    OUTBOUND: { 
      variant: 'destructive', 
      icon: TrendingDown, 
      label: 'Outbound',
      className: 'bg-red-100 text-red-800 hover:bg-red-100' 
    },
    TRANSFER: { 
      variant: 'secondary', 
      icon: ArrowRight, 
      label: 'Transfer',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' 
    },
    ADJUSTMENT: { 
      variant: 'outline', 
      icon: null, 
      label: 'Adjustment',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-300' 
    },
    RETURN: { 
      variant: 'outline', 
      icon: RotateCcw, 
      label: 'Return',
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-300' 
    },
    DAMAGE: { 
      variant: 'destructive', 
      icon: AlertTriangle, 
      label: 'Damage',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' 
    },
    LOSS: { 
      variant: 'outline', 
      icon: XCircle, 
      label: 'Loss',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-300' 
    },
  };

  const { variant, icon: Icon, label, className } = config[type] || { 
    variant: 'outline', 
    icon: null, 
    label: type,
    className: '' 
  };

  return (
    <Badge variant={variant} className={`gap-1 ${className}`}>
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}