"use client";

import { cn } from "@/lib/utils";

const MIN = 0;
const MAX = 20;

interface ScoreInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function ScoreInput({
  value,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Placar",
}: ScoreInputProps) {
  const clamped = Math.min(MAX, Math.max(MIN, value));

  const handleDecrement = () => {
    if (disabled) return;
    onChange(Math.max(MIN, clamped - 1));
  };

  const handleIncrement = () => {
    if (disabled) return;
    onChange(Math.min(MAX, clamped + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value;
    if (raw === "") {
      onChange(MIN);
      return;
    }
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num)) {
      onChange(Math.min(MAX, Math.max(MIN, num)));
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-card p-1",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || clamped <= MIN}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-40"
        aria-label="Diminuir"
      >
        −
      </button>
      <input
        type="number"
        min={MIN}
        max={MAX}
        value={clamped}
        onChange={handleInputChange}
        disabled={disabled}
        className="w-12 shrink-0 rounded-md border-0 bg-transparent p-1 text-center text-foreground [-moz-appearance:textfield] focus:outline-none focus:ring-2 focus:ring-accent-green [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Valor"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || clamped >= MAX}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-40"
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}
