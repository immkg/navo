export default function LocationCard({ location, actions }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-3">
      <div className="font-medium text-gray-900">{location.name}</div>
      {location.address && (
        <div className="text-sm text-gray-500">{location.address}</div>
      )}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
