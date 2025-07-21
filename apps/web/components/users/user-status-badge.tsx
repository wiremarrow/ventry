import { Badge } from '@ventry/ui';
import { CheckCircle, XCircle } from 'lucide-react';

interface UserStatusBadgeProps {
  isActive: boolean;
}

export function UserStatusBadge({ isActive }: UserStatusBadgeProps) {
  if (isActive) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
      <XCircle className="mr-1 h-3 w-3" />
      Inactive
    </Badge>
  );
}