import { clsx } from 'clsx'

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'gray'

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-900 text-blue-300',
  green: 'bg-green-900 text-green-300',
  red: 'bg-red-900 text-red-300',
  yellow: 'bg-yellow-900 text-yellow-300',
  gray: 'bg-gray-700 text-gray-300',
}

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
