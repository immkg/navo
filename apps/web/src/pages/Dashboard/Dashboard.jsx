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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Intents</h1>
          <p className="text-gray-600 mt-1">What are you trying to achieve?</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-sm hover:bg-blue-700 font-medium transition"
          >
            + New Intent
          </button>
          <Link
            to="/planner"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg shadow-sm hover:bg-gray-800 font-medium transition"
          >
            Go to Planner &rarr;
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading intents...
        </div>
      ) : intents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {intents.map((intent) => (
            <Link
              key={intent.id}
              to={`/intent/${intent.id}`}
              className="block p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {intent.title}
              </h2>
              {intent.description && (
                <p className="text-gray-500 mt-2 text-sm line-clamp-2">
                  {intent.description}
                </p>
              )}
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full capitalize">
                  {intent.status}
                </span>
                <span className="text-sm text-gray-400 group-hover:text-blue-500 transition-colors">
                  View Graph &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">You have no active intents.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
          >
            + Create your first Intent
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
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
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring focus:ring-blue-200 outline-none"
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
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring focus:ring-blue-200 outline-none min-h-[100px]"
                  value={newIntentDescription}
                  onChange={(e) => setNewIntentDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newIntentTitle.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition"
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
