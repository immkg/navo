import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard/Dashboard";
import IntentView from "./pages/IntentView/IntentView";
import PlannerView from "./pages/PlannerView/PlannerView";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white border-b border-gray-200 py-4 px-6 mb-6">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <a href="/" className="text-xl font-bold tracking-tight">
              Navo
            </a>
            <nav className="flex gap-4">
              <a
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Intents
              </a>
              <a
                href="/planner"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Planner
              </a>
            </nav>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/intent/:id" element={<IntentView />} />
            <Route path="/planner" element={<PlannerView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
