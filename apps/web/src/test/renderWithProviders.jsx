import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../components/ThemeProvider";
import { NotificationProvider } from "../components/NotificationProvider";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui, { route = "/", queryClient } = {}) {
  const client = queryClient || createTestQueryClient();

  return {
    queryClient: client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <ThemeProvider>
            <NotificationProvider>{ui}</NotificationProvider>
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}
