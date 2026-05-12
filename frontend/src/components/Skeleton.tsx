import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl', className)}
      style={{ background: 'rgba(255,255,255,0.06)', ...style }}
    />
  )
}

export function GameCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 space-y-3" role="status" aria-label="Carregando jogo">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="w-10 h-7 rounded" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-12 h-10 rounded-none" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="w-10 h-7 rounded" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}

export function RankingCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3" role="status" aria-label="Carregando posição">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-14 rounded-xl" />
    </div>
  )
}

export function PodiumSkeleton() {
  const cols = [
    { minHeight: 156, pedestal: 10, flex: 1.05, width: 48 },
    { minHeight: 184, pedestal: 14, flex: 1.2, width: 56 },
    { minHeight: 140, pedestal: 8, flex: 1.05, width: 48 },
  ]
  return (
    <div
      className="glass rounded-3xl p-3 mb-5"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      role="status"
      aria-label="Carregando pódio"
    >
      <Skeleton className="h-3 w-12 rounded mb-2" />
      <div className="flex gap-3 items-end">
        {cols.map((col, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col"
            style={{ flex: col.flex }}
          >
            <div
              className="flex flex-col items-center justify-end gap-2 rounded-t-2xl px-2.5 py-3"
              style={{
                minHeight: col.minHeight,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderBottom: 'none',
              }}
            >
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="w-10 h-3 rounded" />
              <Skeleton className="rounded-full" style={{ width: col.width, height: col.width }} />
              <Skeleton className="w-14 h-3 rounded" />
              <Skeleton className="w-10 h-6 rounded" />
            </div>
            <Skeleton className="w-full rounded-b-xl" style={{ height: col.pedestal }} />
          </div>
        ))}
      </div>
    </div>
  )
}
