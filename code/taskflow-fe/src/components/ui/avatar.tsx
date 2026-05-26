import { cn, avatarGradient, initials } from '@/lib/utils';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  seed?: string | number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  ringClass?: string;
  /** Tooltip native (hover hiển thị tên đầy đủ). Mặc định = name nếu không truyền. */
  title?: string;
}

const sizeMap = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ name, src, seed, size = 'md', className, ringClass, title }: AvatarProps) {
  const gradient = avatarGradient(seed ?? name ?? '');
  const tip = title ?? name ?? undefined;
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        title={tip}
        className={cn('rounded-full object-cover', sizeMap[size], ringClass, className)}
      />
    );
  }
  return (
    <div
      title={tip}
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold flex-shrink-0',
        gradient,
        sizeMap[size],
        ringClass,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
