export default function WorkNode({ work, onAddLocation }) {
  const statusColors = {
    todo: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
  };

  const chosenOption =
    work.locationOptions?.find(
      (option) => option.id === work.selectedLocationOptionId
    ) || work.locationOptions?.[0];

  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="font-medium text-gray-900">{work.title}</h3>
          <div className="mt-1 text-sm text-gray-500">
            {work.durationMinutes || 30} min •{" "}
            <span className="capitalize">{work.type}</span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${statusColors[work.status] || statusColors.todo}`}
        >
          {work.status}
        </span>
      </div>

      {work.contexts && work.contexts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {work.contexts.map((ctx) => (
            <span
              key={ctx.id}
              className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded"
            >
              {ctx.name} ({ctx.type})
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600 space-y-3">
        <div>
          <div className="font-medium text-gray-800">Location option</div>
          {chosenOption ? (
            <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
              {chosenOption.title && (
                <div className="text-sm font-semibold text-gray-900">
                  {chosenOption.title}
                </div>
              )}
              <div className="text-sm text-gray-700">
                {chosenOption.locations?.length ?? 0} place option
              </div>
              {chosenOption.locations?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {chosenOption.locations.map((location) => (
                    <div
                      key={location.id}
                      className="rounded-xl bg-white border border-gray-200 p-3"
                    >
                      <div className="font-medium text-gray-900">
                        {location.name}
                      </div>
                      {location.address && (
                        <div className="text-gray-500 text-xs">
                          {location.address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">
              No location option selected yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
        <button
          className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          onClick={() =>
            alert(`This would hit POST /api/work/${work.id}/context`)
          }
        >
          + Context
        </button>
        <button
          className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
          onClick={() =>
            alert(`This would hit POST /api/work/${work.id}/dependency`)
          }
        >
          + Dependency
        </button>
        <button
          className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded transition-colors"
          onClick={() => onAddLocation?.(work)}
        >
          + Location
        </button>
      </div>
    </div>
  );
}
