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
    <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Intents</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">What are you trying to achieve?</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {intents.map((intent) => (
            <Link
              key={intent.id}
              to={`/intent/${intent.id}`}
              className="group block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md sm:p-5"
            >
              <h2 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 sm:text-xl">
                {intent.title}
              </h2>
              {intent.description && (
                <p className="text-gray-500 mt-2 text-sm line-clamp-2">
                  {intent.description}
                </p>
              )}
              <div className="mt-4 space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-between">
                  <span>{intent.workCount ?? 0} work</span>
                  <span>{intent.completedWorkCount ?? 0} done</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{intent.placeCount ?? 0} place{intent.placeCount === 1 ? "" : "s"}</span>
                  <span className="text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full capitalize">
                    {intent.status}
                  </span>
                </div>
                <div className="pt-1 text-sm text-gray-400 transition-colors group-hover:text-blue-500">
                  Open &rarr;
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center sm:p-12">
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
