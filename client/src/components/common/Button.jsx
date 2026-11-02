import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button with loading state and clinical styling
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'teal' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  icon: Icon = null,
  disabled = false,
  className = '',
  type = 'button',
  onClick = null,
  ...props
}) {
  const variantClass = {
    primary:   'btn-primary',
    teal:      'btn-teal',
    secondary: 'btn-secondary',
    outline:   'btn-outline',
    ghost:     'btn-ghost',
    danger:    'btn-danger',
  }[variant] || 'btn-primary';

  const sizeClass = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  }[size] || '';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
