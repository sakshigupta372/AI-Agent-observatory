import { cn } from '../../lib/utils.js'

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'glass rounded-xl text-card-foreground shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 p-4', className)} {...props} />
}

function CardTitle({ className, ...props }) {
  return (
    <div
      className={cn('text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
