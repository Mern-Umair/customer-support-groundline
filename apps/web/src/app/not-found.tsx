import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="font-mono text-sm text-fg-subtle">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">That page does not exist</h1>
        <p className="mt-2 text-sm text-fg-muted">The link may be old, or the workspace it pointed to is private.</p>
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary" size="sm">
            Back to Groundline
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
