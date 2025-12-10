'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FixedToolbarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function FixedToolbar({
  className,
  children,
  ...props
}: FixedToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 border-b border-border bg-muted/40 p-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}



