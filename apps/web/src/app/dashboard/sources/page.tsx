export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge sources</h1>
      <p className="mt-1 text-sm text-zinc-600">Website pages and documents the assistant is allowed to answer from.</p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        Source ingestion lands next. You will add a URL or upload a PDF here.
      </div>
    </div>
  );
}
