import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const bienThe = cva(
  'inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/12 text-primary-dam',
        accent: 'border-transparent bg-accent/15 text-accent-dam',
        outline: 'text-foreground',
        success: 'border-transparent bg-success/14 text-success-dam',
        warning: 'border-transparent bg-warning/16 text-warning-dam',
        destructive: 'border-transparent bg-destructive/14 text-destructive-dam',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof bienThe> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(bienThe({ variant }), className)} {...props} />;
}

export { bienThe as badgeVariants };
