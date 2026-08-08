import React, { useEffect, useState } from 'react';
import axios from 'axios';
import WorkNode from '../../components/WorkNode';

export default function PlannerView() {
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWork() {
      try {
        const response = await axios.get('http://localhost:3001/api/work');
        // Simple logic for Planner: just show todo/in-progress items
        const actionable = response.data.filter(w => w.status !== 'done');
        setWorkItems(actionable);
      } catch (error) {
        console.error("Failed to fetch work", error);
      } finally {
        setLoading(false);
      }
    }
    fetchWork();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Daily Planner</h1>
        <p className="text-gray-600 mt-2">What is actionable based on your current context?</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading planner...</div>
      ) : workItems.length > 0 ? (
        <div className="space-y-4">
          {workItems.map(work => (
            <div key={work.id} className="relative">
              {work.intent && (
                <div className="text-xs text-gray-500 mb-1 ml-1 font-medium">
                  {work.intent.title}
                </div>
              )}
              <WorkNode work={work} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-green-50 rounded-xl border border-green-100">
          <p className="text-green-800 text-lg font-medium">No actionable work right now.</p>
          <p className="text-sm text-green-600 mt-2">Take a break, or review your active intents to discover new work.</p>
        </div>
      )}
    </div>
  );
}
