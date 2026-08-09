import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { searchPlaces } from "../../utils/googleMaps";

export default function IntentView() {
  const { id } = useParams();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [newWorkDuration, setNewWorkDuration] = useState(30);
  const [newWorkNotes, setNewWorkNotes] = useState("");
  const [newWorkMode, setNewWorkMode] = useState("remote");
  const [newWorkLocationOptionGroups, setNewWorkLocationOptionGroups] = useState([]);
  const [newWorkSelectedOptionGroupIndex, setNewWorkSelectedOptionGroupIndex] = useState(0);
  const [newWorkPlaceQuery, setNewWorkPlaceQuery] = useState("");
  const [newWorkPlaceResults, setNewWorkPlaceResults] = useState([]);
  const [newWorkPlaceSearchError, setNewWorkPlaceSearchError] = useState(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    async function fetchIntent() {
      try {
        const response = await axios.get(
          `http://localhost:3001/api/intents/${id}`
        );
        setIntent(response.data);
      } catch (error) {
        console.error("Failed to fetch intent", error);
      } finally {
        setLoading(false);
      }
    }
    fetchIntent();
  }, [id]);

  const handleCreateWork = async (event) => {
    event.preventDefault();
    if (!newWorkTitle.trim()) return;
setIsSubmitting(true);
      try {
        const payload = {
          title: newWorkTitle.trim(),
          durationMinutes: Number(newWorkDuration) || 30,
          notes: newWorkNotes.trim() || undefined,
          intentId: id,
        };

        if (newWorkMode === "place") {
          if (newWorkLocationOptionGroups.length === 0) {
            alert("Please add at least one location option group for place-based work.");
            return;
          }

          payload.locationOptions = newWorkLocationOptionGroups
            .map((group) => ({
              title: group.title?.trim() || undefined,
              locations: group.locations
                .filter((location) => location.name)
                .map((location) => ({
                  name: location.name,
                  address: location.address,
                  latitude: location.latitude,
                  longitude: location.longitude,
                  placeId: location.placeId,
                  provider: location.provider,
                })),
            }))
            .filter((option) => option.locations.length > 0);

          if (payload.locationOptions.length === 0) {
            alert("Please add at least one place to your location option groups.");
            return;
          }
        }

      const res = await axios.post("http://localhost:3001/api/work", payload);
      const newWork = res.data;
      setIntent({
        ...intent,
        workItems: [
          {
            ...newWork,
            selectedLocationOptionId:
              newWork.selectedLocationOptionId ||
              newWork.locationOptions?.[0]?.id,
          },
          ...(intent.workItems || []),
        ],
      });
      setNewWorkTitle("");
      setNewWorkDuration(30);
      setNewWorkNotes("");
      setNewWorkMode("remote");
      setNewWorkLocationOptionGroups([]);
      setNewWorkSelectedOptionGroupIndex(0);
    } catch (error) {
      console.error("Failed to create work", error);
      alert("Failed to create work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLocationOption = async (work) => {
    const title = window.prompt(
      "New location option title (optional)",
      work.locationOptions?.length ? `Option ${work.locationOptions.length + 1}` : "Option 1"
    );
    if (title === null) return;

    const name = window.prompt("Location name");
    if (!name?.trim()) {
      alert("Location name is required.");
      return;
    }

    const address = window.prompt("Location address (optional)");

    try {
      const response = await axios.post(
        `http://localhost:3001/api/work/${work.id}/location-option`,
        {
          title: title.trim() || undefined,
          locations: [
            {
              name: name.trim(),
              address: address?.trim() || undefined,
            },
          ],
        }
      );

      setIntent((prev) => ({
        ...prev,
        workItems: prev.workItems.map((item) =>
          item.id === work.id
            ? {
                ...item,
                locationOptions: [...(item.locationOptions || []), response.data],
              }
            : item
        ),
      }));
    } catch (error) {
      console.error("Failed to add location option", error);
      alert("Failed to add location option");
    }
  };

  const handleSelectLocationOption = async (workId, optionId) => {
    try {
      const response = await axios.patch(`http://localhost:3001/api/work/${workId}`, {
        selectedLocationOptionId: optionId,
      });
      const updated = response.data;
      setIntent((prev) => ({
        ...prev,
        workItems: prev.workItems.map((item) =>
          item.id === workId
            ? { ...item, selectedLocationOptionId: updated.selectedLocationOptionId }
            : item
        ),
      }));
    } catch (error) {
      console.error("Failed to select location option", error);
      alert("Failed to choose location option");
    }
  };

  const getChosenOption = (work) => {
    if (!work.locationOptions || work.locationOptions.length === 0) {
      return null;
    }
    return (
      work.locationOptions.find(
        (option) => option.id === work.selectedLocationOptionId
      ) || work.locationOptions[0]
    );
  };

  const handleAddLocationOptionGroup = () => {
    const nextIndex = newWorkLocationOptionGroups.length;
    setNewWorkLocationOptionGroups((prev) => [
      ...prev,
      { title: `Option ${nextIndex + 1}`, locations: [] },
    ]);
    setNewWorkSelectedOptionGroupIndex(nextIndex);
  };

  const handlePreparePlaceSearch = (groupIndex) => {
    setNewWorkSelectedOptionGroupIndex(groupIndex);
    setNewWorkPlaceQuery("");
    setNewWorkPlaceResults([]);
    setNewWorkPlaceSearchError(null);
  };

  const handleSearchPlaces = async () => {
    if (!googleKey) {
      setNewWorkPlaceSearchError("Google Maps API key is not configured.");
      return;
    }

    if (!newWorkPlaceQuery.trim()) {
      setNewWorkPlaceSearchError("Enter a place name or address to search.");
      return;
    }

    setIsSearchingPlaces(true);
    setNewWorkPlaceSearchError(null);

    try {
      const results = await searchPlaces(newWorkPlaceQuery.trim(), googleKey);
      setNewWorkPlaceResults(results);
    } catch (error) {
      console.error("Place search failed", error);
      setNewWorkPlaceSearchError(error.message || "Place search failed.");
      setNewWorkPlaceResults([]);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleAddLocationResultToGroup = (groupIndex, place) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      const group = next[groupIndex];
      if (!group) return prev;
      group.locations = [
        ...group.locations,
        {
          name: place.name,
          address: place.formattedAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          placeId: place.placeId,
          provider: "google",
        },
      ];
      return next;
    });
    setNewWorkPlaceResults([]);
    setNewWorkPlaceQuery("");
  };

  const openPlaceInMaps = (place) => {
    const query = encodeURIComponent(place.name || place.formattedAddress || "");
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading intent...</div>
    );
  if (!intent)
    return <div className="p-8 text-center text-red-500">Intent not found</div>;

  const workCount = intent.workItems?.length || 0;
  const completedCount = intent.workItems?.filter((work) => work.status === "done")
    .length || 0;
  const placeCount = new Set(
    intent.workItems?.flatMap((work) =>
      work.locationOptions?.flatMap((option) =>
        option.locations?.map((location) => location.id) || []
      ) || []
    ) || []
  ).size;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          &larr; Intents
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{intent.title}</h1>
            {intent.description && (
              <p className="text-gray-600 mt-2 text-lg">{intent.description}</p>
            )}
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Intent status</div>
            <div className="mt-2 text-lg font-semibold text-gray-900 capitalize">
              {intent.status}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.8fr_1fr]">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">Work</h2>
              <p className="text-sm text-gray-500 mt-1">
                What needs to happen?
              </p>
            </div>
            <button
              onClick={() => {
                const form = document.getElementById("new-work-form");
                form?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + Add Work
            </button>
          </div>

          {intent.workItems && intent.workItems.length > 0 ? (
            <div className="grid gap-4">
              {intent.workItems.map((work) => (
                <div
                  key={work.id}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{work.title}</h3>
                      <div className="mt-1 text-sm text-gray-500">
                        {work.durationMinutes || 30} min • {work.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                      {work.locationOptions?.length > 0
                        ? `${work.locationOptions.length} option${
                            work.locationOptions.length === 1 ? "" : "s"
                          }`
                        : "No location"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddLocationOption(work)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                    >
                      + Location option
                    </button>
                  </div>
                  </div>

                  {work.notes && (
                    <div className="mt-4 text-sm text-gray-600">{work.notes}</div>
                  )}

                  {work.locationOptions && work.locationOptions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-3xl border border-gray-200 bg-blue-50 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-blue-900">
                              Chosen location option
                            </div>
                            <div className="text-sm text-blue-700">
                              {getChosenOption(work)?.title || `Option 1`}
                            </div>
                            {getChosenOption(work)?.locations?.length > 0 && (
                              <div className="text-xs text-blue-700 mt-1">
                                {getChosenOption(work).locations.length} place{getChosenOption(work).locations.length === 1 ? "" : "s"}
                              </div>
                            )}
                          </div>
                          <div className="text-xs rounded-full bg-white px-3 py-1 text-blue-700 border border-blue-200">
                            {work.locationOptions.length} option{work.locationOptions.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      {work.locationOptions.map((option, index) => {
                        const isSelected = option.id === work.selectedLocationOptionId;
                        return (
                          <div
                            key={option.id}
                            className={`rounded-3xl border p-4 ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {option.title || `Option ${index + 1}`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {option.locations.length} place{option.locations.length === 1 ? "" : "s"}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelectLocationOption(work.id, option.id)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${isSelected ? "border border-blue-500 bg-blue-500 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
                              >
                                {isSelected ? "Selected" : "Select option"}
                              </button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {option.locations.map((location) => (
                                <div
                                  key={location.id}
                                  className="rounded-2xl bg-white border border-gray-200 p-3"
                                >
                                  <div className="font-medium text-gray-900">
                                    {location.name}
                                  </div>
                                  {location.address && (
                                    <div className="text-sm text-gray-500">
                                      {location.address}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">No work has been added yet.</p>
              <p className="text-sm text-gray-400">
                Add something that needs to happen and optionally describe where it can be done.
              </p>
            </div>
          )}

          <div id="new-work-form" className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Work</h2>
            <form onSubmit={handleCreateWork} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What needs to happen?
                </label>
                <input
                  value={newWorkTitle}
                  onChange={(e) => setNewWorkTitle(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Buy ingredients, call electrician, review document"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newWorkDuration}
                    onChange={(e) => setNewWorkDuration(Number(e.target.value))}
                    className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    value={newWorkNotes}
                    onChange={(e) => setNewWorkNotes(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Add context or details"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div className="text-sm font-medium text-gray-700">Work location</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4">
                    <input
                      type="radio"
                      name="newWorkMode"
                      value="remote"
                      checked={newWorkMode === "remote"}
                      onChange={() => setNewWorkMode("remote")}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Remote (mobile / laptop)</div>
                      <div className="text-sm text-gray-500">No physical location required.</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4">
                    <input
                      type="radio"
                      name="newWorkMode"
                      value="place"
                      checked={newWorkMode === "place"}
                      onChange={() => setNewWorkMode("place")}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Requires one or more places</div>
                      <div className="text-sm text-gray-500">Add location option groups for route-aware work.</div>
                    </div>
                  </label>
                </div>
                <p className="text-sm text-gray-500">
                  Remote work can be done anywhere. Place-driven work will create one or more location option groups.
                </p>
              </div>

              {newWorkMode === "place" && (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Location option groups</div>
                      <div className="text-sm text-gray-500">
                        Add a group first, then add places inside it using Google Maps.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAddLocationOptionGroup}
                        className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        + Add option group
                      </button>
                      {newWorkLocationOptionGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handlePreparePlaceSearch(newWorkSelectedOptionGroupIndex)}
                          className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                        >
                          + Search places
                        </button>
                      )}
                    </div>
                  </div>

                  {newWorkLocationOptionGroups.length > 0 && (
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Search places for {newWorkLocationOptionGroups[newWorkSelectedOptionGroupIndex]?.title || `Option ${newWorkSelectedOptionGroupIndex + 1}`}</div>
                          <div className="text-sm text-gray-500">Enter a query and add a place from Google Maps search results.</div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Active group: {newWorkSelectedOptionGroupIndex + 1}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={newWorkPlaceQuery}
                          onChange={(e) => setNewWorkPlaceQuery(e.target.value)}
                          placeholder="Search for a place"
                          className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleSearchPlaces}
                          disabled={isSearchingPlaces}
                          className="rounded-full bg-blue-600 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {isSearchingPlaces ? "Searching…" : "Search"}
                        </button>
                      </div>
                      {newWorkPlaceSearchError && (
                        <div className="mt-3 text-sm text-red-600">{newWorkPlaceSearchError}</div>
                      )}
                      {newWorkPlaceResults.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {newWorkPlaceResults.map((place, resultIndex) => (
                            <div
                              key={resultIndex}
                              className="rounded-2xl border border-gray-200 bg-gray-50 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-gray-900">{place.name}</div>
                                  {place.formattedAddress && (
                                    <div className="text-sm text-gray-500">{place.formattedAddress}</div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openPlaceInMaps(place)}
                                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                                  >
                                    Locate on map
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddLocationResultToGroup(newWorkSelectedOptionGroupIndex, place)}
                                    className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {newWorkLocationOptionGroups.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                      Add a location option group first, then add one or more places inside it.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {newWorkLocationOptionGroups.map((group, index) => (
                        <div
                          key={index}
                          className={`rounded-3xl border p-4 ${newWorkSelectedOptionGroupIndex === index ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <input
                                value={group.title}
                                onChange={(e) => {
                                  const title = e.target.value;
                                  setNewWorkLocationOptionGroups((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], title };
                                    return next;
                                  });
                                }}
                                placeholder="Option title (optional)"
                                className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                              />
                              <div className="mt-2 text-sm text-gray-500">
                                {group.locations.length} place{group.locations.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNewWorkSelectedOptionGroupIndex(index)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${newWorkSelectedOptionGroupIndex === index ? "border border-blue-500 bg-blue-500 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
                            >
                              {newWorkSelectedOptionGroupIndex === index ? "Selected" : "Select"}
                            </button>
                          </div>
                          {group.locations.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {group.locations.map((location, locationIndex) => (
                                <div
                                  key={locationIndex}
                                  className="rounded-2xl bg-white border border-gray-200 p-3"
                                >
                                  <div className="font-medium text-gray-900">{location.name}</div>
                                  {location.address && (
                                    <div className="text-sm text-gray-500">{location.address}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewWorkTitle("");
                    setNewWorkDuration(30);
                    setNewWorkNotes("");
                    setNewWorkMode("remote");
                    setNewWorkLocationOptionGroups([]);
                    setNewWorkSelectedOptionGroupIndex(0);
                  }}
                  className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newWorkTitle.trim()}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Adding..." : "Add Work"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Places</h2>
              <p className="text-sm text-gray-500 mt-1">Derived from your work options.</p>
            </div>
            <button
              onClick={() => window.location.href = "/planner"}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              Plan this Intent
            </button>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Work</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {workCount}
              </div>
              <div className="text-sm text-gray-500">
                {completedCount} complete
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Places</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {placeCount}
              </div>
              <div className="text-sm text-gray-500">
                Derived automatically from work options.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
