import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import { useRecommendedWork } from "./hooks";

// The single top-ranked not-done work item (same priority/urgency score the
// plan builder uses), surfaced with no Plan required — "what should I do
// right now" without setting up a time-boxed window first.
export default function NextBestActionBanner() {
  const { data: recommended = [] } = useRecommendedWork(1);
  const topWork = recommended[0];

  if (!topWork) return null;

  return (
    <Card padding="md" className="mb-4 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Next best action
          </div>
          <div className="mt-1 font-medium text-foreground">
            {topWork.title}
          </div>
        </div>
        {topWork.intentId && (
          <Link
            to={`/intent/${topWork.intentId}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View
          </Link>
        )}
      </div>
    </Card>
  );
}
