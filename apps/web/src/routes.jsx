import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./pages/Dashboard";
import IntentPage from "./pages/IntentPage";
import PlannerPage from "./pages/PlannerPage";
import { NotificationProvider } from "./components/NotificationProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";

const queryClient = new QueryClient();

export default function AppRoutes() {
  const navBase =
    "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition";
  const navActive = "bg-primary text-primary-foreground";
  const navInactive =
    "text-muted-foreground hover:bg-surface-alt hover:text-foreground";

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-background font-sans text-foreground">
              <header className="sticky top-0 z-40 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
                  <NavLink to="/" className="text-xl font-bold tracking-tight">
                    Navo
                  </NavLink>
                  <div className="flex items-center gap-2">
                    <nav
                      className="hidden items-center gap-2 sm:flex"
                      aria-label="Primary"
                    >
                      <NavLink
                        to="/"
                        className={({ isActive }) =>
                          `${navBase} ${isActive ? navActive : navInactive}`
                        }
                      >
                        Intents
                      </NavLink>
                      <NavLink
                        to="/planner"
                        className={({ isActive }) =>
                          `${navBase} ${isActive ? navActive : navInactive}`
                        }
                      >
                        Planner
                      </NavLink>
                    </nav>
                    <ThemeToggle />
                  </div>
                </div>
              </header>

              <main className="pb-24 sm:pb-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/intent/:id" element={<IntentPage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                </Routes>
              </main>

              <footer
                className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur sm:hidden"
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
                          ? navActive
                          : "text-foreground hover:bg-surface-alt"
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
                          ? navActive
                          : "text-foreground hover:bg-surface-alt"
                      }`
                    }
                  >
                    Planner
                  </NavLink>
                </nav>
              </footer>
            </div>
          </NotificationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
