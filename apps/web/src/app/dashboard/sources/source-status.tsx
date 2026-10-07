import { Badge } from "@/components/ui/badge";
import type { SourceDto } from "@/lib/ingest/dto";

const map: Record<SourceDto["status"], { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  queued: { label: "Queued", tone: "neutral" },
  discovering: { label: "Discovering pages", tone: "accent" },
  processing: { label: "Indexing", tone: "accent" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function SourceStatusBadge({ status }: { status: SourceDto["status"] }) {
  const { label, tone } = map[status];
  const live = status === "discovering" || status === "processing";
  return (
    <Badge tone={tone}>
      {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
      {label}
    </Badge>
  );
}
