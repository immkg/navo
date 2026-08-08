import React from 'react';

export default function WorkNode({ work }) {
  const statusColors = {
    todo: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-900">{work.title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[work.status] || statusColors.todo}`}>
          {work.status}
        </span>
      </div>
      <div className="mt-2 text-sm text-gray-500">
        Type: <span className="capitalize">{work.type}</span>
      </div>
      {work.contexts && work.contexts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {work.contexts.map(ctx => (
            <span key={ctx.id} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
              {ctx.name} ({ctx.type})
            </span>
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
        <button 
          className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          onClick={() => alert(`This would hit POST /api/work/${work.id}/context`)}
        >
          + Context
        </button>
        <button 
          className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
          onClick={() => alert(`This would hit POST /api/work/${work.id}/dependency`)}
        >
          + Dependency
        </button>
      </div>
    </div>
  );
}
