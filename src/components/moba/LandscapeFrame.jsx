import React from 'react';
import { usePortrait, landscapeStyle } from './landscape';

export function LandscapeFrame({ children, className = '', ...rest }) {
  const portrait = usePortrait();
  return (
    <div style={landscapeStyle(portrait)} className={className} data-portrait={portrait} {...rest}>
      {children}
    </div>
  );
}
