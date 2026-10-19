import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({
  width,
  height,
  borderRadius,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const combinedStyle: React.CSSProperties = {
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(borderRadius !== undefined && { borderRadius }),
    ...style,
  };

  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={combinedStyle}
      aria-hidden="true"
      {...props}
    />
  );
}
