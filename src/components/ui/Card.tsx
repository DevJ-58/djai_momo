import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: 'article' | 'section' | 'div';
};

export function Card({ children, as: Element = 'article', className = '', ...props }: CardProps) {
  return <Element className={`glass card ${className}`} {...props}>{children}</Element>;
}
