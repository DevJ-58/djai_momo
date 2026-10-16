type AvatarProps = {
  name: string;
  size?: 'small' | 'medium' | 'large';
};

export function Avatar({ name, size = 'medium' }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase('fr');

  return <span className={`avatar avatar-${size}`} aria-label={name}>{initials || '?'}</span>;
}
