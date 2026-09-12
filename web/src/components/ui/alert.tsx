import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const bienThe = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-primary/25 bg-primary/5 text-foreground',
      success: 'border-success/30 bg-success/5 text-foreground',
      warning: 'border-warning/35 bg-warning/5 text-foreground',
      destructive: 'border-destructive/35 bg-destructive/5 text-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

const ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
} as const;

const MAU_ICON = {
  info: 'text-primary-dam',
  success: 'text-success-dam',
  warning: 'text-warning-dam',
  destructive: 'text-destructive-dam',
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bienThe> {
  tieuDe?: string;
}

export function Alert({ className, variant, tieuDe, children, ...props }: AlertProps) {
  const loai = variant ?? 'info';
  const Icon = ICON[loai];
  return (
    <div role="alert" className={cn(bienThe({ variant }), className)} {...props}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', MAU_ICON[loai])} aria-hidden />
      <div className="min-w-0 space-y-1">
        {tieuDe ? <p className="font-medium">{tieuDe}</p> : null}
        <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
      </div>
    </div>
  );
}
