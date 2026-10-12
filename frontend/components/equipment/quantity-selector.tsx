'use client';

// A small stepper - used on both the Student and Secretary booking UI.
// Typing a value directly is allowed (not clamped to `max`) so the
// quantity-exceeds-available validation state is actually reachable.
export function QuantitySelector({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
        className="flex h-7 w-7 items-center justify-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        aria-label="Quantity"
        className="h-7 w-12 rounded border border-white/15 bg-white/5 text-center text-sm text-white [appearance:textfield] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max || value + 1, value + 1))}
        disabled={disabled || (max > 0 && value >= max)}
        aria-label="Increase quantity"
        className="flex h-7 w-7 items-center justify-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
