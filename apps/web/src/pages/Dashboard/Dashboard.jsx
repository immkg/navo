import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function Dashboard() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntents() {
      try {
        const response = await axios.get("http://localhost:3001/api/intents");
        setIntents(response.data);
      } catch (error) {
        console.error("Failed to fetch intents", error);
      } finally {
        setLoading(false);
      }
    }
    fetchIntents();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIntentTitle, setNewIntentTitle] = useState("");
  const [newIntentDescription, setNewIntentDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateIntent = async (e) => {
    e.preventDefault();
    if (!newIntentTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await axios.post("http://localhost:3001/api/intents", {
        title: newIntentTitle,
        description: newIntentDescription,
      });
      setIntents([res.data, ...intents]);
      setIsModalOpen(false);
      setNewIntentTitle("");
      setNewIntentDescription("");
    } catch (error) {
      console.error("Failed to create intent", error);
      alert("Failed to create intent. Make sure the API is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-5 pt-3 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="mb-4 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">Intents</h1>
            <p className="mt-0.5 text-xs text-gray-600 sm:mt-1 sm:text-base">What are you trying to achieve?</p>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + New Intent
            </button>
            <Link
              to="/planner"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
            >
              Go to Planner
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading intents...
        </div>
      ) : intents.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {intents.map((intent) => (
            <Link
              key={intent.id}
              to={`/intent/${intent.id}`}
              className="group block rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md sm:p-5"
            >
              {(() => {
                const workCount = intent.workCount ?? 0;
                const doneCount = intent.completedWorkCount ?? 0;
                const placeCount = intent.placeCount ?? 0;
                const remainingWork = Math.max(workCount - doneCount, 0);
                const completion = workCount > 0 ? Math.round((doneCount / workCount) * 100) : 0;
                const hasPlace = placeCount > 0;

                return (
                  <>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-gray-900 transition-colors group-hover:text-blue-600 sm:text-xl">
                        {intent.title}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 sm:text-xs">
                        {completion}%
                      </span>
                    </div>

                    {intent.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 sm:mt-2 sm:text-sm">
                        {intent.description}
                      </p>
                    )}

                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 sm:text-xs">
                        <span>{doneCount} complete</span>
                        <span>{remainingWork} left</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:text-sm">
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500 sm:text-xs">Work</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{workCount}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500 sm:text-xs">Places</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{placeCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 sm:text-xs">
                        {hasPlace ? "Ready to schedule by place" : "Add a place to unlock planning"}
                      </span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium capitalize text-green-800 sm:px-2.5 sm:py-1 sm:text-xs">
                        {intent.status}
                      </span>
                    </div>

                    <div className="pt-2 text-xs font-medium text-blue-600 transition-colors group-hover:text-blue-700 sm:text-sm">
                      Open intent &rarr;
                    </div>
                  </>
                );
              })()}
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center sm:p-12">
          <p className="text-gray-500 mb-4">You have no active intents.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
          >
            + Create your first Intent
          </button>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900 sm:text-2xl">
              Create New Intent
            </h2>
            <form onSubmit={handleCreateIntent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What is your intent?
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g., Plan a vacation"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                  value={newIntentTitle}
                  onChange={(e) => setNewIntentTitle(e.target.value)}
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Add some details about what you want to achieve"
                  className="min-h-[100px] w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                  value={newIntentDescription}
                  onChange={(e) => setNewIntentDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newIntentTitle.trim()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Intent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
