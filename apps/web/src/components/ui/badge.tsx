import type { ComponentProps } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className = "", ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

/** A source citation. Always teal so "grounded" reads as a brand signal everywhere. */
export function CitationChip({ title, detail }: { title: string; detail?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent-soft-fg">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 2.5h5.5L13 6v7.5H4z" />
        <path d="M9.5 2.5V6H13" />
      </svg>
      <span className="truncate">{title}</span>
      {detail ? <span className="opacity-70">· {detail}</span> : null}
    </span>
  );
}
