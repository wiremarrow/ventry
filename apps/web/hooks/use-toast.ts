import { toast as sonnerToast } from 'sonner';

export function toast({
  title,
  description,
  variant = 'default',
}: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) {
  if (variant === 'destructive') {
    sonnerToast.error(title, {
      description,
    });
  } else {
    sonnerToast(title, {
      description,
    });
  }
}

export const useToast = () => {
  return {
    toast,
  };
};