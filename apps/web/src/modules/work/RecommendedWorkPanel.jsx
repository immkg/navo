import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import { useRecommendedWork } from "./hooks";

const RECOMMENDED_LIMIT = 5;

// Not-done work ranked by the same priority/urgency score the plan builder
// uses, with no Plan required — "what's worth doing" at a glance, distinct
// from the single top pick NextBestActionBanner already shows.
export default function RecommendedWorkPanel() {
  const { data: recommended = [] } = useRecommendedWork(RECOMMENDED_LIMIT);

  if (recommended.length === 0) return null;

  return (
    <Card padding="md" className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recommended work
      </div>
      <ul className="space-y-1">
        {recommended.map((work) => (
          <li
            key={work.id}
            className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-alt"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {work.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {work.priority} priority
              </div>
            </div>
            {work.intentId && (
              <Link
                to={`/intent/${work.intentId}`}
                className="shrink-0 text-sm font-semibold text-primary hover:underline"
              >
                View
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
