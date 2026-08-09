import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import WorkNode from "../../components/WorkNode";
import { geocodeLocation } from "../../utils/googleMaps";

export default function IntentView() {
  const { id } = useParams();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [newWorkType, setNewWorkType] = useState("task");
  const [newWorkDuration, setNewWorkDuration] = useState(30);
  const [newWorkLocationName, setNewWorkLocationName] = useState("");
  const [newWorkLocationAddress, setNewWorkLocationAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const handleDiscoverWork = async (event) => {
    event.preventDefault();
    if (!newWorkTitle.trim()) return;

    setIsSubmitting(true);
    let locationPayload = newWorkLocationName.trim()
      ? [
          {
            name: newWorkLocationName.trim(),
            address: newWorkLocationAddress.trim() || undefined,
          },
        ]
      : null;

    if (googleKey && locationPayload) {
      try {
        const query =
          `${newWorkLocationName.trim()} ${newWorkLocationAddress.trim()}`.trim();
        if (query) {
          const geo = await geocodeLocation(query, googleKey);
          locationPayload[0] = {
            ...locationPayload[0],
            latitude: geo.latitude,
            longitude: geo.longitude,
            address: geo.formattedAddress,
          };
        }
      } catch (error) {
        console.warn(
          "Location geocoding failed, falling back to manual location data",
          error
        );
      }
    }

    try {
      const payload = {
        title: newWorkTitle.trim(),
        type: newWorkType,
        durationMinutes: Number(newWorkDuration) || 30,
        intentId: id,
      };

      if (locationPayload) {
        payload.locations = locationPayload;
      }

      const res = await axios.post("http://localhost:3001/api/work", payload);

      setIntent({
        ...intent,
        workItems: [res.data, ...(intent.workItems || [])],
      });
      setNewWorkTitle("");
      setNewWorkLocationName("");
      setNewWorkLocationAddress("");
      setNewWorkDuration(30);
    } catch (error) {
      console.error("Failed to create work", error);
      alert("Failed to create work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLocation = async (work) => {
    const name = window.prompt("Location name (e.g. Farmers Market)");
    if (!name) return;
    const address = window.prompt("Address or place details (optional)");

    try {
      let locationData = {
        name: name.trim(),
        address: address?.trim() || undefined,
      };

      if (googleKey) {
        try {
          const query = `${name.trim()} ${address?.trim() || ""}`.trim();
          const geo = await geocodeLocation(query, googleKey);
          locationData = {
            ...locationData,
            latitude: geo.latitude,
            longitude: geo.longitude,
            address: geo.formattedAddress,
          };
        } catch (geocodeError) {
          console.warn("Failed to geocode added location", geocodeError);
        }
      }

      const res = await axios.post(
        `http://localhost:3001/api/work/${work.id}/location`,
        locationData
      );
      setIntent({
        ...intent,
        workItems: intent.workItems.map((item) =>
          item.id === work.id ? res.data : item
        ),
      });
    } catch (error) {
      console.error("Failed to attach location", error);
      alert("Failed to attach location.");
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading intent...</div>
    );
  if (!intent)
    return <div className="p-8 text-center text-red-500">Intent not found</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{intent.title}</h1>
        {intent.description && (
          <p className="text-gray-600 mt-2 text-lg">{intent.description}</p>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.8fr_1fr]">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Work Graph</h2>
          </div>
          {intent.workItems && intent.workItems.length > 0 ? (
            <div className="grid gap-4">
              {intent.workItems.map((work) => (
                <WorkNode
                  key={work.id}
                  work={work}
                  onAddLocation={handleAddLocation}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">
                No work discovered for this intent yet.
              </p>
              <p className="text-sm text-gray-400">
                Planning is a continuous process. What needs to happen to move
                this forward?
              </p>
            </div>
          )}
        </section>

        <aside className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Discover new work
          </h2>
          <form onSubmit={handleDiscoverWork} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work title
              </label>
              <input
                value={newWorkTitle}
                onChange={(e) => setNewWorkTitle(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Book hotel, buy groceries, call mechanic"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newWorkType}
                  onChange={(e) => setNewWorkType(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="task">Task</option>
                  <option value="decision">Decision</option>
                  <option value="research">Research</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={newWorkDuration}
                  min={5}
                  step={5}
                  onChange={(e) => setNewWorkDuration(Number(e.target.value))}
                  className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location name
              </label>
              <input
                value={newWorkLocationName}
                onChange={(e) => setNewWorkLocationName(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Farmers Market, Office, Vet"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location address
              </label>
              <input
                value={newWorkLocationAddress}
                onChange={(e) => setNewWorkLocationAddress(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                placeholder="123 Main St, City, State"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newWorkTitle.trim()}
              className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Adding work…" : "Add work"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
