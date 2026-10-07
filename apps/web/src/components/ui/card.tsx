import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-lg border border-border bg-surface shadow-card ${className}`} {...props} />;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v7a1.5 1.5 0 0 1-1.5 1.5H8l-4 3v-3h-.5A1.5 1.5 0 0 1 3 12.5z" />
          <path d="M7 8h6M7 10.5h3.5" />
        </svg>
      </div>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
