import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn's class combiner: merges conditional classes and de-dupes conflicting
// Tailwind utilities (the later one wins).
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
