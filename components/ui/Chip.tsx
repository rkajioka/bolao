import { cn } from "@/lib/utils";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function Chip({ className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-card px-2.5 py-0.5 text-xs font-medium text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
