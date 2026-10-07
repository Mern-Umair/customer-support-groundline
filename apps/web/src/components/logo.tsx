import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-md bg-accent">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent-fg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 11h12" />
          <path d="M4 7.5h8" />
          <path d="M6.5 4h3" />
        </svg>
      </span>
      Groundline
    </Link>
  );
}
