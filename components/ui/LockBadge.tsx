import { cn } from "@/lib/utils";

interface LockBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function LockBadge({ className, children, ...props }: LockBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-foreground/80",
        className
      )}
      {...props}
    >
      <span aria-hidden>🔒</span>
      {children ?? "Travado"}
    </span>
  );
}
