import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Ghép class Tailwind, class sau ghi đè class trước khi trùng nhóm. */
export function cn(...dauVao: ClassValue[]): string {
  return twMerge(clsx(dauVao));
}
