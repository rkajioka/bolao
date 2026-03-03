import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children?: React.ReactNode;
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" &&
          "bg-accent-green text-primary hover:bg-accent-green/90 focus:ring-accent-green",
        variant === "secondary" &&
          "border border-white/20 bg-card text-foreground hover:bg-white/5 focus:ring-foreground/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
