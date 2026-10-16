import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import { APP_NAME, APP_TAGLINE } from '../../lib/brand';

type LogoProps = {
  variant: 'full' | 'icon';
  size?: number;
  className?: string;
};

type LogoStyle = CSSProperties & { '--logo-size': string };

export function Logo({ variant, size, className = '' }: LogoProps) {
  const [hasSolidBackground, setHasSolidBackground] = useState(false);
  const style: LogoStyle | undefined = size === undefined ? undefined : { '--logo-size': `${size}px` };

  const detectBackground = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const corners = [
      3,
      (width - 1) * 4 + 3,
      ((height - 1) * width) * 4 + 3,
      ((height * width) - 1) * 4 + 3,
    ];
    setHasSolidBackground(corners.every((index) => data[index] === 255));
  };

  return (
    <span
      className={`brand-logo brand-logo-${variant}${hasSolidBackground ? ' brand-logo-solid' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <img
        src="/logo.png"
        width="376"
        height="664"
        alt={`${APP_NAME}, ${APP_TAGLINE.toLowerCase()}`}
        loading="eager"
        decoding="async"
        onLoad={detectBackground}
      />
    </span>
  );
}
