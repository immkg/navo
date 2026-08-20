import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard/Dashboard";
import IntentView from "./pages/IntentView/IntentView";
import PlannerView from "./pages/PlannerView/PlannerView";
import { NotificationProvider } from "./components/NotificationProvider";

export default function AppRoutes() {
  const navBase =
    "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition";

  return (
    <BrowserRouter>
      <NotificationProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <header className="sticky top-0 z-40 border-b border-gray-200/90 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
              <NavLink to="/" className="text-xl font-bold tracking-tight">
                Navo
              </NavLink>
              <nav
                className="hidden items-center gap-2 sm:flex"
                aria-label="Primary"
              >
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `${navBase} ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`
                  }
                >
                  Intents
                </NavLink>
                <NavLink
                  to="/planner"
                  className={({ isActive }) =>
                    `${navBase} ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`
                  }
                >
                  Planner
                </NavLink>
              </nav>
            </div>
          </header>

          <main className="pb-24 sm:pb-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/intent/:id" element={<IntentView />} />
              <Route path="/planner" element={<PlannerView />} />
            </Routes>
          </main>

          <footer
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden"
            style={{
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <nav
              className="mx-auto grid max-w-md grid-cols-2 gap-2"
              aria-label="Bottom navigation"
            >
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                Intents
              </NavLink>
              <NavLink
                to="/planner"
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                Planner
              </NavLink>
            </nav>
          </footer>
        </div>
      </NotificationProvider>
    </BrowserRouter>
  );
}
