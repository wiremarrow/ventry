import { Badge } from '@ventry/ui';
import { CheckCircle2, AlertCircle, Clock, XCircle, FileText, Package } from 'lucide-react';

interface ReceiptStatusBadgeProps {
  poStatus: string;
  hasDiscrepancy?: boolean;
}

export function ReceiptStatusBadge({ poStatus, hasDiscrepancy }: ReceiptStatusBadgeProps) {
  // If there's a discrepancy, show that as priority
  if (hasDiscrepancy) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 bg-orange-100 text-orange-800 border-orange-300">
        <AlertCircle className="h-3 w-3" />
        Discrepancy
      </Badge>
    );
  }

  // Otherwise show PO status
  const statusConfig: Record<string, { variant: any; icon: any; label: string; className?: string }> = {
    APPROVED: { 
      variant: 'secondary' as const, 
      icon: Clock, 
      label: 'Awaiting Receipt',
      className: 'bg-blue-100 text-blue-800 border-blue-300'
    },
    PARTIAL: { 
      variant: 'secondary' as const, 
      icon: Package, 
      label: 'Partially Received',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    },
    RECEIVED: { 
      variant: 'default' as const, 
      icon: CheckCircle2, 
      label: 'Fully Received',
      className: 'bg-green-100 text-green-800 border-green-300'
    },
    CANCELLED: { 
      variant: 'destructive' as const, 
      icon: XCircle, 
      label: 'Cancelled',
      className: 'bg-red-100 text-red-800 border-red-300'
    },
    DRAFT: { 
      variant: 'outline' as const, 
      icon: FileText, 
      label: 'Draft PO',
      className: 'bg-gray-100 text-gray-800 border-gray-300'
    },
    SUBMITTED: { 
      variant: 'outline' as const, 
      icon: Clock, 
      label: 'Pending Approval',
      className: 'bg-gray-100 text-gray-800 border-gray-300'
    },
  };

  const config = statusConfig[poStatus] || { 
    variant: 'outline' as const, 
    icon: FileText, 
    label: poStatus,
    className: 'bg-gray-100 text-gray-800 border-gray-300'
  };
  
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}