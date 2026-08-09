import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import IntentWorkForm from "./IntentWorkForm";
import LocationCard from "./LocationCard";

function IntentSummaryCard({ intent, onPatchIntent, updatingIntent }) {
  const [intentTitle, setIntentTitle] = useState(intent.title || "");
  const [intentDescription, setIntentDescription] = useState(intent.description || "");
  const [intentPriority, setIntentPriority] = useState(intent.priority || "medium");
  const [intentStatus, setIntentStatus] = useState(intent.status || "active");
  const [intentStartDate, setIntentStartDate] = useState(
    intent.startDate ? new Date(intent.startDate).toISOString().slice(0, 10) : ""
  );
  const [intentDueDate, setIntentDueDate] = useState(
    intent.dueDate ? new Date(intent.dueDate).toISOString().slice(0, 10) : ""
  );

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const openDateInput = (inputId) => {
    const element = document.getElementById(inputId);
    if (!element) return;

    if (typeof element.showPicker === "function") {
      element.showPicker();
      return;
    }

    element.focus();
    element.click();
  };

  const handleUpdateStartDate = async (startDateValue) => {
    setIntentStartDate(startDateValue);
    await onPatchIntent({ startDate: startDateValue || null });
  };

  const handleUpdateDueDate = async (dueDateValue) => {
    setIntentDueDate(dueDateValue);
    await onPatchIntent({ dueDate: dueDateValue || null });
  };

  const handleUpdatePriority = async (priority) => {
    setIntentPriority(priority);
    await onPatchIntent({ priority });
  };

  const handleUpdateStatus = async (status) => {
    setIntentStatus(status);
    await onPatchIntent({ status });
  };

  const hasTextChanges = intentTitle.trim() !== (intent.title || "") || intentDescription.trim() !== (intent.description || "");

  const handleUpdateIntentText = async () => {
    const nextTitle = intentTitle.trim();
    const nextDescription = intentDescription.trim();

    if (!nextTitle) {
      setIntentTitle(intent.title || "");
      return;
    }

    await onPatchIntent({
      title: nextTitle,
      description: nextDescription || null,
    });
  };

  return (
    <section className="mb-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Intent</div>
            <input
              value={intentTitle}
              onChange={(e) => setIntentTitle(e.target.value)}
              disabled={updatingIntent}
              className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-2xl font-bold text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 sm:text-3xl"
            />
          </div>
          <textarea
            value={intentDescription}
            onChange={(e) => setIntentDescription(e.target.value)}
            disabled={updatingIntent}
            rows={3}
            placeholder="Add a short description"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
            {hasTextChanges && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleUpdateIntentText}
                  disabled={updatingIntent || !intentTitle.trim()}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Priority</span>
            <select
              value={intentPriority}
              onChange={(e) => handleUpdatePriority(e.target.value)}
              disabled={updatingIntent}
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</span>
            <select
              value={intentStatus}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              disabled={updatingIntent}
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="not_required">Not Required</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Start</span>
            <button
              type="button"
              onClick={() => openDateInput(`intent-start-date-${intent.id}`)}
              disabled={updatingIntent}
              className="relative h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
            >
              <span className="flex h-full items-center">{intentStartDate ? formatDate(intentStartDate) : "No start date"}</span>
              <input
                id={`intent-start-date-${intent.id}`}
                type="date"
                value={intentStartDate}
                onChange={(e) => handleUpdateStartDate(e.target.value)}
                disabled={updatingIntent}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                aria-label="Set start date"
              />
            </button>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Due</span>
            <button
              type="button"
              onClick={() => openDateInput(`intent-due-date-${intent.id}`)}
              disabled={updatingIntent}
              className="relative h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
            >
              <span className="flex h-full items-center">{intentDueDate ? formatDate(intentDueDate) : "No due date"}</span>
              <input
                id={`intent-due-date-${intent.id}`}
                type="date"
                value={intentDueDate}
                onChange={(e) => handleUpdateDueDate(e.target.value)}
                disabled={updatingIntent}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                aria-label="Set due date"
              />
            </button>
          </label>
        </div>
      </div>
    </section>
  );
}

export default function IntentView() {
  const { id } = useParams();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingIntent, setUpdatingIntent] = useState(false);
  const [addingOptionForWorkId, setAddingOptionForWorkId] = useState(null);
  const [newLocationOptionTitle, setNewLocationOptionTitle] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");

  useEffect(() => {
    async function fetchIntent() {
      try {
        const response = await axios.get(`http://localhost:3001/api/intents/${id}`);
        setIntent(response.data);
      } catch (error) {
        console.error("Failed to fetch intent", error);
      } finally {
        setLoading(false);
      }
    }
    fetchIntent();
  }, [id]);

  const handlePatchIntent = async (patch) => {
    setUpdatingIntent(true);

    try {
      const response = await axios.patch(`http://localhost:3001/api/intents/${id}`, patch);
      setIntent(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to update intent", error);
      alert("Unable to update intent right now.");
      throw error;
    } finally {
      setUpdatingIntent(false);
    }
  };


  const handleAddLocationOption = async (workId, title, name, address) => {
    if (!name?.trim()) {
      alert("Location name is required.");
      return;
    }

    try {
      const response = await axios.post(`http://localhost:3001/api/work/${workId}/location-option`, {
        title: title.trim() || undefined,
        locations: [
          {
            name: name.trim(),
            address: address?.trim() || undefined,
          },
        ],
      });

      setIntent((prev) => ({
        ...prev,
        workItems: prev.workItems.map((item) =>
          item.id === workId
            ? {
                ...item,
                locationOptions: [...(item.locationOptions || []), response.data],
              }
            : item
        ),
      }));

      setAddingOptionForWorkId(null);
      setNewLocationOptionTitle("");
      setNewLocationName("");
      setNewLocationAddress("");
    } catch (error) {
      console.error("Failed to add location option", error);
      alert("Failed to add location option");
    }
  };

  const startAddLocationOption = (work) => {
    setAddingOptionForWorkId(work.id);
    setNewLocationOptionTitle(
      work.locationOptions?.length ? `Option ${work.locationOptions.length + 1}` : "Option 1"
    );
    setNewLocationName("");
    setNewLocationAddress("");
  };

  const cancelAddLocationOption = () => {
    setAddingOptionForWorkId(null);
    setNewLocationOptionTitle("");
    setNewLocationName("");
    setNewLocationAddress("");
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
    return work.locationOptions.find((option) => option.id === work.selectedLocationOptionId) || work.locationOptions[0];
  };

  const handleWorkCreated = (newWork) => {
    setIntent((prev) => ({
      ...prev,
      workItems: [newWork, ...(prev.workItems || [])],
    }));
  };

  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading intent...</div>;

  if (!intent)
    return <div className="p-8 text-center text-red-500">Intent not found</div>;

  const workCount = intent.workItems?.length || 0;
  const completedCount = intent.workItems?.filter((work) => work.status === "done").length || 0;
  const placeCount = new Set(
    intent.workItems?.flatMap((work) =>
      work.locationOptions?.flatMap((option) => option.locations?.map((location) => location.id) || []) || []
    ) || []
  ).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <IntentSummaryCard intent={intent} onPatchIntent={handlePatchIntent} updatingIntent={updatingIntent} />

      <button
        onClick={() => {
          const form = document.getElementById("new-work-form");
          form?.scrollIntoView({ behavior: "smooth" });
        }}
        className="mb-4 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 sm:mb-6 sm:w-auto"
      >
        + Add Work
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 sm:text-2xl">Work</h2>
              <p className="mt-1 text-sm text-gray-500">What needs to happen?</p>
            </div>
          </div>

          {intent.workItems && intent.workItems.length > 0 ? (
            <div className="grid gap-3 sm:gap-4">
              {intent.workItems.map((work) => (
                <div key={work.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-lg">{work.title}</h3>
                      <div className="mt-1 text-xs text-gray-500 sm:text-sm">
                        {work.durationMinutes || 30} min • {work.status}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-center text-xs font-semibold uppercase text-gray-600">
                        {work.locationOptions?.length > 0
                          ? `${work.locationOptions.length} option${work.locationOptions.length === 1 ? "" : "s"}`
                          : "No location"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startAddLocationOption(work)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        + Location option
                      </button>
                    </div>
                  </div>

                  {addingOptionForWorkId === work.id && (
                    <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 text-sm font-semibold text-gray-900">Add location option</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Option title (optional)</span>
                          <input
                            value={newLocationOptionTitle}
                            onChange={(e) => setNewLocationOptionTitle(e.target.value)}
                            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Option 1"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Location name</span>
                          <input
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Coffee shop, hardware store, office"
                          />
                        </label>
                      </div>
                      <div className="mt-4">
                        <label className="space-y-2 w-full">
                          <span className="text-sm font-medium text-gray-700">Location address (optional)</span>
                          <input
                            value={newLocationAddress}
                            onChange={(e) => setNewLocationAddress(e.target.value)}
                            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="123 Main St, City"
                          />
                        </label>
                      </div>
                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={cancelAddLocationOption}
                          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddLocationOption(work.id, newLocationOptionTitle, newLocationName, newLocationAddress)}
                          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          Add location option
                        </button>
                      </div>
                    </div>
                  )}

                  {work.notes && <div className="mt-4 text-sm text-gray-600">{work.notes}</div>}
                  {work.locationOptions && work.locationOptions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-3xl border border-gray-200 bg-blue-50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div>
                            <div className="text-sm font-semibold text-blue-900">Chosen location option</div>
                            <div className="text-sm text-blue-700">{getChosenOption(work)?.title || `Option 1`}</div>
                            {getChosenOption(work)?.locations?.length > 0 && (
                              <div className="mt-1 text-xs text-blue-700">
                                {getChosenOption(work).locations.length} place{getChosenOption(work).locations.length === 1 ? "" : "s"}
                              </div>
                            )}
                          </div>
                          <div className="self-start rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-700">
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
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{option.title || `Option ${index + 1}`}</div>
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
                                <LocationCard key={location.id} location={location} />
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
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center sm:p-12">
              <p className="text-gray-500 mb-4">No work has been added yet.</p>
              <p className="text-sm text-gray-400">Add something that needs to happen and optionally describe where it can be done.</p>
            </div>
          )}

          <IntentWorkForm intentId={id} onWorkCreated={handleWorkCreated} />
        </section>

        <aside className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Places</h2>
              <p className="mt-1 text-sm text-gray-500">Derived from your work options.</p>
            </div>
            <button
              onClick={() => window.location.href = "/planner"}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
            >
              Plan this Intent
            </button>
          </div>

          <div className="grid gap-3 sm:gap-4">
            <div className="rounded-3xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Work</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{workCount}</div>
              <div className="text-sm text-gray-500">{completedCount} complete</div>
            </div>
            <div className="rounded-3xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Places</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{placeCount}</div>
              <div className="text-sm text-gray-500">Derived automatically from work options.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
