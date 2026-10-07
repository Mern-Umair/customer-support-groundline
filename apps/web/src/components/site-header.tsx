import Link from "next/link";
import { ButtonLink } from "./ui/button";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
      <Logo />
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/evals" className="rounded-md px-3 py-2 text-fg-muted hover:text-fg">
          Evals
        </Link>
        <Link href="/login" className="rounded-md px-3 py-2 text-fg-muted hover:text-fg">
          Log in
        </Link>
        <ButtonLink href="/signup" size="sm">
          Start free
        </ButtonLink>
      </nav>
    </header>
  );
}
