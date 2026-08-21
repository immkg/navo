import Card from "../../components/ui/Card";

export default function LocationCard({ location, actions }) {
  return (
    <Card padding="sm">
      <div className="font-medium text-foreground">{location.name}</div>
      {location.address && (
        <div className="text-sm text-muted-foreground">{location.address}</div>
      )}
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </Card>
  );
}
