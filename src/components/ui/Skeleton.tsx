type SkeletonProps = {
  className?: string;
  label?: string;
};

export function Skeleton({ className = '', label = 'Chargement' }: SkeletonProps) {
  return <span className={`skeleton ${className}`} role="status" aria-label={label} />;
}
