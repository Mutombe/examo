import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

export function formatPercentage(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `${num.toFixed(1)}%`
}

export function getScoreColor(percentage: number | string | null | undefined) {
  if (percentage === null || percentage === undefined) return 'text-gray-500'
  const num = typeof percentage === 'string' ? parseFloat(percentage) : percentage
  if (isNaN(num)) return 'text-gray-500'
  if (num >= 80) return 'text-success-600'
  if (num >= 60) return 'text-primary-600'
  if (num >= 40) return 'text-warning-600'
  return 'text-danger-600'
}

export function getScoreBgColor(percentage: number | string | null | undefined) {
  if (percentage === null || percentage === undefined) return 'bg-gray-100'
  const num = typeof percentage === 'string' ? parseFloat(percentage) : percentage
  if (isNaN(num)) return 'bg-gray-100'
  if (num >= 80) return 'bg-success-50'
  if (num >= 60) return 'bg-primary-50'
  if (num >= 40) return 'bg-warning-50'
  return 'bg-danger-50'
}
