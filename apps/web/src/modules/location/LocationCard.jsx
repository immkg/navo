import Card from "../../components/ui/Card";
import { getOpenStatus } from "../../utils/openingHours";

export default function LocationCard({ location, actions }) {
  const { isOpen, label: openStatusLabel } = getOpenStatus(
    location.openingPeriods
  );

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{location.name}</div>
          {location.address && (
            <div className="text-sm text-muted-foreground">
              {location.address}
            </div>
          )}
        </div>
        {location.rating != null && (
          <div className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
            ★ {location.rating}
            {location.ratingsCount != null && (
              <span> ({location.ratingsCount})</span>
            )}
          </div>
        )}
      </div>

      {(openStatusLabel || location.phoneNumber) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
          {openStatusLabel && (
            <span className={isOpen === false ? "text-danger" : "text-success"}>
              {openStatusLabel}
            </span>
          )}
          {location.phoneNumber && (
            <a
              href={`tel:${location.phoneNumber}`}
              className="font-semibold text-primary hover:underline"
            >
              📞 {location.phoneNumber}
            </a>
          )}
        </div>
      )}

      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </Card>
  );
}
