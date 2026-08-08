import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import WorkNode from '../../components/WorkNode';

export default function IntentView() {
  const { id } = useParams();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleDiscoverWork = async () => {
    const title = window.prompt("What work needs to happen? (e.g., Book hotel)");
    if (!title) return;
    const type = window.prompt("Type of work? (task, decision, research)", "task");
    
    try {
      const res = await axios.post('http://localhost:3001/api/work', { title, type, intentId: id });
      setIntent({ ...intent, workItems: [res.data, ...(intent.workItems || [])] });
    } catch (error) {
      console.error("Failed to create work", error);
      alert("Failed to create work");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading intent...</div>;
  if (!intent) return <div className="p-8 text-center text-red-500">Intent not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
        <h1 className="text-3xl font-bold text-gray-900">{intent.title}</h1>
        {intent.description && <p className="text-gray-600 mt-2 text-lg">{intent.description}</p>}
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Work Graph</h2>
          <button 
            onClick={handleDiscoverWork}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
          >
            + Discover Work
          </button>
        </div>
        
        {intent.workItems && intent.workItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intent.workItems.map(work => (
              <WorkNode key={work.id} work={work} />
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">No work discovered for this intent yet.</p>
            <p className="text-sm text-gray-400">Planning is a continuous process. What needs to happen to move this forward?</p>
          </div>
        )}
      </div>
    </div>
  );
}
