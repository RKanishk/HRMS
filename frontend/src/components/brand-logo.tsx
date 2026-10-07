import Image from 'next/image';
import { BRAND } from '@/lib/brand';

export function BrandLogo({
  height = 44,
  variant = 'dark',
  priority = false,
}: {
  height?: number;
  variant?: 'dark' | 'light';
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === 'light' ? BRAND.logoLight : BRAND.logo}
      alt={`${BRAND.name} logo`}
      width={Math.round(BRAND.aspect * height)}
      height={height}
      priority={priority}
    />
  );
}
