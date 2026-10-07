import { EmptyState } from "@/components/ui/card";

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge sources</h1>
      <p className="mt-1 text-sm text-fg-muted">Website pages and documents the assistant is allowed to answer from.</p>
      <div className="mt-8">
        <EmptyState title="No sources yet" body="Source ingestion lands next. You will add a website URL or upload a PDF here, and watch it get crawled, chunked and indexed." />
      </div>
    </div>
  );
}
