import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  id?: string;
}

export const Card = ({ children, className, hover, id }: CardProps) => (
  <div
    id={id}
    className={cn(
      'bg-white rounded-xl shadow-card border border-gray-100',
      hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
      className
    )}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

Card.Header = ({ children, className }: CardHeaderProps) => (
  <div className={cn('px-6 py-4 border-b border-gray-100', className)}>
    {children}
  </div>
);

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

Card.Body = ({ children, className }: CardBodyProps) => (
  <div className={cn('px-6 py-4', className)}>{children}</div>
);

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

Card.Footer = ({ children, className }: CardFooterProps) => (
  <div className={cn('px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl', className)}>
    {children}
  </div>
);

export default Card;
