# Plan-Based Planner — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `PlannerPage.jsx` with two new pages — a Plans list/create
view and a Plan detail/execution view — wired to the `/api/plans` and
`/api/ai/plan-variations` endpoints from the backend plan.

**Architecture:** A thin API client module and a TanStack Query hooks
module mirror the existing `modules/work` and `modules/ai` patterns exactly.
A small reusable `PlanLocationPicker` handles the start/end
location+date/time inputs shared by the create form. `PlansListPage` and
`PlanDetailPage` are plain page components consuming the hooks, reusing the
existing `Card`/`Button`/`Badge`/`Modal` UI primitives and the Google Maps
JS rendering pattern already proven in the old `PlannerPage.jsx`.

**Tech Stack:** React 19, Vite 8, React Router 7, TanStack Query v5,
Tailwind v4 utility classes, Vitest + React Testing Library, ESM throughout
`apps/web`.

**Spec:** `docs/superpowers/specs/2026-08-22-plan-based-planner-design.md`

## Global Constraints

- **This plan depends on the backend plan being merged first.** Every task
  below assumes `/api/plans/*` and `/api/ai/plan-variations` already exist
  on `main` (see `docs/superpowers/plans/2026-08-22-plan-based-planner-backend.md`).
  Do not start Task 1 until that PR is merged.
- Before any lint/test/build command: `source ~/.nvm/nvm.sh && nvm use
20.19.3`.
- All work happens on one branch, `feat/plan-based-planner-frontend`,
  created from an up-to-date `main`. Commit after each task. Open the PR
  only after Task 8's full verification passes. Then: push, `gh pr create`,
  `gh pr checks <N> --watch` until green, `gh pr merge <N> --squash
--delete-branch`, confirm `main` is clean/up-to-date. Never commit
  directly to `main`.
- Run `npx vitest run` (in `apps/web`) after every task — not just the new
  test file — to catch regressions in pages/hooks that share query keys or
  caches with the new plan module.
- Run `npm run lint` (in `apps/web`) and `npx prettier --check` before every
  commit; fix anything flagged.
- Every new file follows the existing module layout:
  `apps/web/src/api/*.js` for thin `apiClient` wrappers,
  `apps/web/src/modules/<name>/hooks.js` for TanStack Query hooks,
  `apps/web/src/pages/*.jsx` for routed pages — matching `modules/work`,
  `modules/ai`, and `pages/IntentPage.jsx`/`pages/PlannerPage.jsx`.
- Every mutation hook follows the error-handling shape already used in
  `PlannerPage.jsx`/`IntentPage.jsx`: call the mutation inside a
  `try`/`catch` in the page component, `console.error` on failure, and
  `notify(error.response?.data?.error || "<fallback message>")` via
  `useNotifications()`.
- **Known gap, out of scope for this plan:** there is no UI to set
  `Work.priority` from a value other than its `"medium"` default — the spec
  section (§7) this plan implements only covers the two new Plan pages, not
  `WorkFormModal`. Flagging this explicitly rather than silently expanding
  scope; a follow-up task should add a priority selector to `WorkFormModal`
  (mirroring `modules/intents/PrioritySelect.jsx`) so the algorithm's
  scoring has real signal to work with beyond intent priority and due
  dates.

---

### Task 1: `api/plans.js` + `api/ai.js` addition

**Files:**

- Create: `apps/web/src/api/plans.js`
- Modify: `apps/web/src/api/ai.js`
- Test: `apps/web/src/api/plans.test.js`, `apps/web/src/api/ai.test.js`

**Interfaces:**

- Produces: `getPlans()`, `createPlan(data)`, `getPlan(id)`,
  `updatePlan(id, patch)`, `deletePlan(id)`, `recheckPlan(id, data)`,
  `updatePlanStop(planId, stopId, patch)`, `updatePlanStopWork(planId,
stopId, workId, patch)` from `api/plans.js`; `planVariations(selectedWork,
unselectedWork, budgetMinutes)` added to `api/ai.js`. Every later task's
  hooks (Task 3) call these by these exact names.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git pull
git checkout -b feat/plan-based-planner-frontend
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/api/plans.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import {
  createPlan,
  deletePlan,
  getPlan,
  getPlans,
  recheckPlan,
  updatePlan,
  updatePlanStop,
  updatePlanStopWork,
} from "./plans";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("getPlans", () => {
  it("fetches the plan list", async () => {
    apiClient.get.mockResolvedValue({ data: [{ id: "plan-1" }] });

    const result = await getPlans();

    expect(apiClient.get).toHaveBeenCalledWith("/api/plans");
    expect(result).toEqual([{ id: "plan-1" }]);
  });
});

describe("createPlan", () => {
  it("posts the plan data and returns the response body", async () => {
    apiClient.post.mockResolvedValue({ data: { id: "plan-1" } });
    const data = { startAt: "2026-08-22T09:00:00.000Z" };

    const result = await createPlan(data);

    expect(apiClient.post).toHaveBeenCalledWith("/api/plans", data);
    expect(result).toEqual({ id: "plan-1" });
  });
});

describe("getPlan", () => {
  it("fetches one plan by id", async () => {
    apiClient.get.mockResolvedValue({ data: { id: "plan-1" } });

    const result = await getPlan("plan-1");

    expect(apiClient.get).toHaveBeenCalledWith("/api/plans/plan-1");
    expect(result).toEqual({ id: "plan-1" });
  });
});

describe("updatePlan", () => {
  it("patches the plan and returns the response body", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "plan-1", title: "Renamed" },
    });

    const result = await updatePlan("plan-1", { title: "Renamed" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/plans/plan-1", {
      title: "Renamed",
    });
    expect(result.title).toBe("Renamed");
  });
});

describe("deletePlan", () => {
  it("deletes the plan", async () => {
    apiClient.delete.mockResolvedValue({});

    await deletePlan("plan-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/plans/plan-1");
  });
});

describe("recheckPlan", () => {
  it("posts the recheck payload and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { plan: { id: "plan-1" }, variations: [] },
    });

    const result = await recheckPlan("plan-1", { latitude: 1, longitude: 1 });

    expect(apiClient.post).toHaveBeenCalledWith("/api/plans/plan-1/recheck", {
      latitude: 1,
      longitude: 1,
    });
    expect(result.variations).toEqual([]);
  });
});

describe("updatePlanStop", () => {
  it("patches a plan stop", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "stop-1", status: "done" },
    });

    const result = await updatePlanStop("plan-1", "stop-1", { status: "done" });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/plans/plan-1/stops/stop-1",
      { status: "done" }
    );
    expect(result.status).toBe("done");
  });
});

describe("updatePlanStopWork", () => {
  it("patches a plan stop's work item", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "psw-1", status: "done" },
    });

    const result = await updatePlanStopWork("plan-1", "stop-1", "work-1", {
      status: "done",
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/plans/plan-1/stops/stop-1/work/work-1",
      { status: "done" }
    );
    expect(result.status).toBe("done");
  });
});
```

Append to `apps/web/src/api/ai.test.js` (add `planVariations` to the
existing top `import { ... } from "./ai"` list):

```js
describe("planVariations", () => {
  it("posts the selected/unselected work and budget, and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { variations: [{ addWorkIds: ["w2"], removeWorkIds: ["w1"] }] },
    });

    const result = await planVariations([{ id: "w1" }], [{ id: "w2" }], 60);

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/plan-variations", {
      selectedWork: [{ id: "w1" }],
      unselectedWork: [{ id: "w2" }],
      budgetMinutes: 60,
    });
    expect(result.variations.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/api/plans.test.js src/api/ai.test.js
```

Expected: `plans.test.js` fails with a module-not-found error; the new
`ai.test.js` block fails with `planVariations is not defined`.

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/api/plans.js`:

```js
import apiClient from "./client";

export async function getPlans() {
  const response = await apiClient.get("/api/plans");
  return response.data;
}

export async function createPlan(data) {
  const response = await apiClient.post("/api/plans", data);
  return response.data;
}

export async function getPlan(id) {
  const response = await apiClient.get(`/api/plans/${id}`);
  return response.data;
}

export async function updatePlan(id, patch) {
  const response = await apiClient.patch(`/api/plans/${id}`, patch);
  return response.data;
}

export async function deletePlan(id) {
  await apiClient.delete(`/api/plans/${id}`);
}

export async function recheckPlan(id, data) {
  const response = await apiClient.post(`/api/plans/${id}/recheck`, data);
  return response.data;
}

export async function updatePlanStop(planId, stopId, patch) {
  const response = await apiClient.patch(
    `/api/plans/${planId}/stops/${stopId}`,
    patch
  );
  return response.data;
}

export async function updatePlanStopWork(planId, stopId, workId, patch) {
  const response = await apiClient.patch(
    `/api/plans/${planId}/stops/${stopId}/work/${workId}`,
    patch
  );
  return response.data;
}
```

Append to `apps/web/src/api/ai.js`:

```js
export async function planVariations(
  selectedWork,
  unselectedWork,
  budgetMinutes
) {
  const response = await apiClient.post("/api/ai/plan-variations", {
    selectedWork,
    unselectedWork,
    budgetMinutes,
  });
  return response.data;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/api/plans.test.js src/api/ai.test.js
```

- [ ] **Step 6: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/api/plans.js apps/web/src/api/plans.test.js apps/web/src/api/ai.js apps/web/src/api/ai.test.js
```

```bash
git add apps/web/src/api/plans.js apps/web/src/api/plans.test.js apps/web/src/api/ai.js apps/web/src/api/ai.test.js
git commit -m "Add plans API client and planVariations AI client"
```

---

### Task 2: `modules/plan/hooks.js`

**Files:**

- Create: `apps/web/src/modules/plan/hooks.js`
- Test: `apps/web/src/modules/plan/hooks.test.jsx`

**Interfaces:**

- Consumes: `apps/web/src/api/plans.js` (Task 1), `WORK_QUERY_KEY` from
  `apps/web/src/modules/work/hooks.js` (existing).
- Produces: `PLANS_QUERY_KEY`, `planQueryKey(id)`, `usePlans()`,
  `usePlan(id)`, `useCreatePlan()`, `useUpdatePlan()`, `useDeletePlan()`,
  `useRecheckPlan()`, `useUpdatePlanStop()`, `useUpdatePlanStopWork()`.
  Tasks 5–7 (`PlansListPage`, `PlanDetailPage`) import all of these.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/plan/hooks.test.jsx`:

```jsx
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import * as plansApi from "../../api/plans";
import {
  useCreatePlan,
  useDeletePlan,
  usePlan,
  usePlans,
  useRecheckPlan,
  useUpdatePlan,
  useUpdatePlanStop,
  useUpdatePlanStopWork,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePlans", () => {
  it("fetches the plan list", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([{ id: "plan-1" }]);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => usePlans(), {
      wrapper: withQueryClient(queryClient),
    });

    await vi.waitFor(() =>
      expect(result.current.data).toEqual([{ id: "plan-1" }])
    );
  });
});

describe("usePlan", () => {
  it("fetches one plan and skips the request when id is missing", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue({ id: "plan-1" });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => usePlan("plan-1"), {
      wrapper: withQueryClient(queryClient),
    });

    await vi.waitFor(() =>
      expect(result.current.data).toEqual({ id: "plan-1" })
    );
    expect(plansApi.getPlan).toHaveBeenCalledWith("plan-1");
  });
});

describe("useCreatePlan", () => {
  it("creates a plan and adds it to the plans list cache", async () => {
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({ id: "plan-new" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plans"], []);

    const { result } = renderHook(() => useCreatePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ startAt: "2026-08-22T09:00:00.000Z" });
    });

    expect(queryClient.getQueryData(["plans"])).toEqual([{ id: "plan-new" }]);
  });
});

describe("useUpdatePlan", () => {
  it("updates the plan detail cache", async () => {
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue({
      id: "plan-1",
      title: "Renamed",
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdatePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        patch: { title: "Renamed" },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"]).title).toBe("Renamed");
  });
});

describe("useDeletePlan", () => {
  it("removes the plan from the list and detail caches", async () => {
    vi.spyOn(plansApi, "deletePlan").mockResolvedValue();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plans"], [{ id: "plan-1" }]);
    queryClient.setQueryData(["plan", "plan-1"], { id: "plan-1" });

    const { result } = renderHook(() => useDeletePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("plan-1");
    });

    expect(queryClient.getQueryData(["plans"])).toEqual([]);
    expect(queryClient.getQueryData(["plan", "plan-1"])).toBeUndefined();
  });
});

describe("useRecheckPlan", () => {
  it("replaces the plan detail cache with the rechecked plan", async () => {
    vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
      plan: { id: "plan-1", stops: [] },
      variations: [],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useRecheckPlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        data: { latitude: 1, longitude: 1 },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"])).toEqual({
      id: "plan-1",
      stops: [],
    });
  });
});

describe("useUpdatePlanStop", () => {
  it("replaces the matching stop inside the plan detail cache", async () => {
    vi.spyOn(plansApi, "updatePlanStop").mockResolvedValue({
      id: "stop-1",
      status: "done",
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plan", "plan-1"], {
      id: "plan-1",
      stops: [{ id: "stop-1", status: "planned" }],
    });

    const { result } = renderHook(() => useUpdatePlanStop(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        stopId: "stop-1",
        patch: { status: "done" },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"]).stops[0].status).toBe(
      "done"
    );
  });
});

describe("useUpdatePlanStopWork", () => {
  it("replaces the matching work assignment and, when done, patches the work list cache", async () => {
    vi.spyOn(plansApi, "updatePlanStopWork").mockResolvedValue({
      id: "psw-1",
      status: "done",
      work: { id: "work-1" },
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plan", "plan-1"], {
      id: "plan-1",
      stops: [
        {
          id: "stop-1",
          works: [{ id: "psw-1", status: "planned" }],
        },
      ],
    });
    queryClient.setQueryData(["work"], [{ id: "work-1", status: "todo" }]);

    const { result } = renderHook(() => useUpdatePlanStopWork(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        stopId: "stop-1",
        workId: "work-1",
        patch: { status: "done" },
      });
    });

    expect(
      queryClient.getQueryData(["plan", "plan-1"]).stops[0].works[0].status
    ).toBe("done");
    expect(queryClient.getQueryData(["work"])[0].status).toBe("done");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/modules/plan/hooks.test.jsx
```

Expected: `Cannot find module './hooks'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/modules/plan/hooks.js`:

```js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlan,
  deletePlan,
  getPlan,
  getPlans,
  recheckPlan,
  updatePlan,
  updatePlanStop,
  updatePlanStopWork,
} from "../../api/plans";
import { WORK_QUERY_KEY } from "../work/hooks";

export const PLANS_QUERY_KEY = ["plans"];
export const planQueryKey = (id) => ["plan", id];

export function usePlans() {
  return useQuery({ queryKey: PLANS_QUERY_KEY, queryFn: getPlans });
}

export function usePlan(id) {
  return useQuery({
    queryKey: planQueryKey(id),
    queryFn: () => getPlan(id),
    enabled: Boolean(id),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: (newPlan) => {
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous = []) => [
        newPlan,
        ...previous,
      ]);
      queryClient.setQueryData(planQueryKey(newPlan.id), newPlan);
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, patch }) => updatePlan(planId, patch),
    onSuccess: (updatedPlan, { planId }) => {
      queryClient.setQueryData(planQueryKey(planId), updatedPlan);
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous) =>
        previous?.map((plan) => (plan.id === planId ? updatedPlan : plan))
      );
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId) => deletePlan(planId),
    onSuccess: (_data, planId) => {
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous) =>
        previous?.filter((plan) => plan.id !== planId)
      );
      queryClient.removeQueries({ queryKey: planQueryKey(planId) });
    },
  });
}

export function useRecheckPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, data }) => recheckPlan(planId, data),
    onSuccess: (result, { planId }) => {
      queryClient.setQueryData(planQueryKey(planId), result.plan);
    },
  });
}

export function useUpdatePlanStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, stopId, patch }) =>
      updatePlanStop(planId, stopId, patch),
    onSuccess: (updatedStop, { planId }) => {
      queryClient.setQueryData(
        planQueryKey(planId),
        (previous) =>
          previous && {
            ...previous,
            stops: previous.stops.map((stop) =>
              stop.id === updatedStop.id ? updatedStop : stop
            ),
          }
      );
    },
  });
}

export function useUpdatePlanStopWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, stopId, workId, patch }) =>
      updatePlanStopWork(planId, stopId, workId, patch),
    onSuccess: (updatedAssignment, { planId, stopId, workId }) => {
      queryClient.setQueryData(
        planQueryKey(planId),
        (previous) =>
          previous && {
            ...previous,
            stops: previous.stops.map((stop) =>
              stop.id === stopId
                ? {
                    ...stop,
                    works: stop.works.map((assignment) =>
                      assignment.id === updatedAssignment.id
                        ? updatedAssignment
                        : assignment
                    ),
                  }
                : stop
            ),
          }
      );

      if (updatedAssignment.status === "done") {
        queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
          previous?.map((item) =>
            item.id === workId ? { ...item, status: "done" } : item
          )
        );
      }
    },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/modules/plan/hooks.test.jsx
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/modules/plan/hooks.js apps/web/src/modules/plan/hooks.test.jsx
```

```bash
git add apps/web/src/modules/plan/hooks.js apps/web/src/modules/plan/hooks.test.jsx
git commit -m "Add plan TanStack Query hooks"
```

---

### Task 3: `modules/plan/PlanLocationPicker.jsx`

**Files:**

- Create: `apps/web/src/modules/plan/PlanLocationPicker.jsx`
- Test: `apps/web/src/modules/plan/PlanLocationPicker.test.jsx`

**Interfaces:**

- Consumes: `searchPlaces` from `apps/web/src/utils/googleMaps.js`
  (existing).
- Produces: `<PlanLocationPicker legend={string} value={{dateTime,
label, latitude, longitude}} onChange={(next) => void} />`. `dateTime`
  is a `datetime-local`-formatted string (`"YYYY-MM-DDTHH:mm"`). Task 5
  (`PlansListPage`) renders two of these, one for start and one for end.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/plan/PlanLocationPicker.test.jsx`:

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as googleMaps from "../../utils/googleMaps";
import PlanLocationPicker from "./PlanLocationPicker";

function Wrapper({ initialValue }) {
  const [value, setValue] = require("react").useState(initialValue);
  return (
    <PlanLocationPicker legend="Start" value={value} onChange={setValue} />
  );
}

describe("PlanLocationPicker", () => {
  afterEach(() => {
    delete navigator.geolocation;
    vi.unstubAllEnvs();
  });

  it("updates the date/time value", () => {
    const onChange = vi.fn();
    render(
      <PlanLocationPicker
        legend="Start"
        value={{ dateTime: "", label: "", latitude: null, longitude: null }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-08-22T09:00" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateTime: "2026-08-22T09:00" })
    );
  });

  it("uses the device's current location", () => {
    const onChange = vi.fn();
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 12, longitude: 34 } }),
    };

    render(
      <PlanLocationPicker
        legend="Start"
        value={{
          dateTime: "2026-08-22T09:00",
          label: "",
          latitude: null,
          longitude: null,
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("📍 Use current location"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 12,
        longitude: 34,
        label: "Current location",
      })
    );
  });

  it("searches for a place and lets the user pick a result", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    const onChange = vi.fn();
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      {
        name: "Downtown",
        formattedAddress: "Downtown, Some City",
        latitude: 1,
        longitude: 2,
      },
    ]);

    render(
      <PlanLocationPicker
        legend="Start"
        value={{
          dateTime: "2026-08-22T09:00",
          label: "",
          latitude: null,
          longitude: null,
        }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search a city or address"), {
      target: { value: "Downtown" },
    });
    fireEvent.click(screen.getByText("Search"));

    fireEvent.click(await screen.findByText("Downtown"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Downtown", latitude: 1, longitude: 2 })
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/modules/plan/PlanLocationPicker.test.jsx
```

Expected: `Cannot find module './PlanLocationPicker'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/modules/plan/PlanLocationPicker.jsx`:

```jsx
import { useState } from "react";
import { searchPlaces } from "../../utils/googleMaps";
import Button from "../../components/ui/Button";

// Shared start/end picker for a plan's create form: a date/time input, a
// device-geolocation shortcut, a Places search, and a manual lat/lng
// fallback for when neither of those has what you need.
export default function PlanLocationPicker({ legend, value, onChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Your device doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => setSearchError("Couldn't get your current location.")
    );
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!googleKey || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchPlaces(searchQuery.trim(), googleKey, null);
      setSearchResults(results);
    } catch (error) {
      setSearchError(error.message || "Search failed.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickResult = (place) => {
    onChange({
      ...value,
      label: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {legend}
      </legend>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Date &amp; time
        </span>
        <input
          type="datetime-local"
          required
          value={value.dateTime}
          onChange={(event) =>
            onChange({ ...value, dateTime: event.target.value })
          }
          className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleUseCurrentLocation}
        >
          📍 Use current location
        </Button>
        {value.label && (
          <span className="text-sm text-muted-foreground">{value.label}</span>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search a city or address"
          className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isSearching}
        >
          {isSearching ? "Searching…" : "Search"}
        </Button>
      </form>

      {searchError && <p className="text-sm text-danger">{searchError}</p>}

      {searchResults.length > 0 && (
        <ul className="space-y-1">
          {searchResults.map((place) => (
            <li key={place.placeId || place.name}>
              <button
                type="button"
                onClick={() => handlePickResult(place)}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-alt"
              >
                {place.name}
                {place.formattedAddress && (
                  <span className="block text-xs text-muted-foreground">
                    {place.formattedAddress}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer select-none">
          Enter coordinates manually
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide">
              Latitude
            </span>
            <input
              type="number"
              step="any"
              value={value.latitude ?? ""}
              onChange={(event) =>
                onChange({ ...value, latitude: Number(event.target.value) })
              }
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide">
              Longitude
            </span>
            <input
              type="number"
              step="any"
              value={value.longitude ?? ""}
              onChange={(event) =>
                onChange({ ...value, longitude: Number(event.target.value) })
              }
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
            />
          </label>
        </div>
      </details>
    </fieldset>
  );
}
```

The date/time `<input>` needs an accessible label for the test's
`getByLabelText(/date/i)` to find it — the `<label>` wrapping it already
provides that association, so no extra markup is needed.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/modules/plan/PlanLocationPicker.test.jsx
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/modules/plan/PlanLocationPicker.jsx apps/web/src/modules/plan/PlanLocationPicker.test.jsx
```

```bash
git add apps/web/src/modules/plan/PlanLocationPicker.jsx apps/web/src/modules/plan/PlanLocationPicker.test.jsx
git commit -m "Add PlanLocationPicker"
```

---

### Task 4: `PlansListPage.jsx`

**Files:**

- Create: `apps/web/src/pages/PlansListPage.jsx`
- Test: `apps/web/src/pages/PlansListPage.test.jsx`

**Interfaces:**

- Consumes: `usePlans`, `useCreatePlan` (Task 2), `PlanLocationPicker`
  (Task 3).
- Produces: default export `PlansListPage`, a page component with no
  props (reads nothing from route params). Task 8 wires it to `/planner`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/pages/PlansListPage.test.jsx`:

```jsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import PlansListPage from "./PlansListPage";

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PlansListPage />} />
      <Route path="/plan/:id" element={<div>Plan detail stub</div>} />
    </Routes>
  );
}

describe("PlansListPage", () => {
  it("shows existing plans", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([
      {
        id: "plan-1",
        title: "Saturday errands",
        status: "draft",
        startAt: "2026-08-22T09:00:00.000Z",
        endAt: "2026-08-22T12:00:00.000Z",
        stops: [],
      },
    ]);

    renderPage();

    expect(await screen.findByText("Saturday errands")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("shows an empty state when there are no plans", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText("No plans yet. Create one to get started.")
    ).toBeInTheDocument();
  });

  it("creates a plan from the form and navigates to its detail page", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage();

    fireEvent.click(await screen.findByText("+ New plan"));
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    const [payload] = plansApi.createPlan.mock.calls[0];
    expect(payload.startAt).toBeTruthy();
    expect(payload.endAt).toBeTruthy();
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/pages/PlansListPage.test.jsx
```

Expected: `Cannot find module './PlansListPage'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/pages/PlansListPage.jsx`:

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import { useCreatePlan, usePlans } from "../modules/plan/hooks";
import PlanLocationPicker from "../modules/plan/PlanLocationPicker";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

function defaultDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 3600000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function emptyLocation(hoursFromNow) {
  return {
    dateTime: defaultDateTime(hoursFromNow),
    label: "",
    latitude: null,
    longitude: null,
  };
}

export default function PlansListPage() {
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const { data: plans = [], isLoading } = usePlans();
  const createPlanMutation = useCreatePlan();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(emptyLocation(0));
  const [end, setEnd] = useState(emptyLocation(8));

  const resetForm = () => {
    setTitle("");
    setStart(emptyLocation(0));
    setEnd(emptyLocation(8));
    setShowCreateForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!start.dateTime || !end.dateTime) {
      notify("Start and end date/time are required.");
      return;
    }

    try {
      const plan = await createPlanMutation.mutateAsync({
        title: title.trim() || undefined,
        startAt: new Date(start.dateTime).toISOString(),
        startLabel: start.label || undefined,
        startLatitude: start.latitude,
        startLongitude: start.longitude,
        endAt: new Date(end.dateTime).toISOString(),
        endLabel: end.label || undefined,
        endLatitude: end.latitude,
        endLongitude: end.longitude,
      });
      resetForm();
      navigate(`/plan/${plan.id}`);
    } catch (error) {
      console.error("Failed to create plan", error);
      notify(error.response?.data?.error || "Failed to create plan");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Time-boxed plans that fit as much work as reasonably possible
            between a start and an end.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm((open) => !open)}
        >
          {showCreateForm ? "Cancel" : "+ New plan"}
        </Button>
      </div>

      {showCreateForm && (
        <Card padding="lg" className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Title (optional)
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Saturday errands"
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
              />
            </label>

            <PlanLocationPicker
              legend="Start"
              value={start}
              onChange={setStart}
            />
            <PlanLocationPicker legend="End" value={end} onChange={setEnd} />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createPlanMutation.isPending}
              >
                {createPlanMutation.isPending ? "Building…" : "Create plan"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
          No plans yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              as="button"
              onClick={() => navigate(`/plan/${plan.id}`)}
              className="text-left transition hover:bg-surface-alt"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-foreground">
                    {plan.title || new Date(plan.startAt).toLocaleDateString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(plan.startAt).toLocaleString()} →{" "}
                    {new Date(plan.endAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
                  {plan.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/pages/PlansListPage.test.jsx
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/pages/PlansListPage.jsx apps/web/src/pages/PlansListPage.test.jsx
```

```bash
git add apps/web/src/pages/PlansListPage.jsx apps/web/src/pages/PlansListPage.test.jsx
git commit -m "Add PlansListPage"
```

---

### Task 5: `PlanDetailPage.jsx` — read-only detail + status controls

**Files:**

- Create: `apps/web/src/pages/PlanDetailPage.jsx`
- Test: `apps/web/src/pages/PlanDetailPage.test.jsx`

**Interfaces:**

- Consumes: `usePlan`, `useUpdatePlan` (Task 2); `loadGoogleMaps` from
  `apps/web/src/utils/googleMaps.js` (existing).
- Produces: default export `PlanDetailPage`, reading `:id` via
  `useParams()`. Task 6 adds execution behavior to this same file; Task 8
  wires it to `/plan/:id`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/pages/PlanDetailPage.test.jsx`:

```jsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import PlanDetailPage from "./PlanDetailPage";

function basePlan(overrides = {}) {
  return {
    id: "plan-1",
    title: "Saturday errands",
    status: "draft",
    startAt: "2026-08-22T09:00:00.000Z",
    startLatitude: 0,
    startLongitude: 0,
    endAt: "2026-08-22T12:00:00.000Z",
    endLatitude: 0,
    endLongitude: 0,
    stops: [],
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/:id" element={<PlanDetailPage />} />
    </Routes>,
    { route: "/plan/plan-1" }
  );
}

describe("PlanDetailPage", () => {
  afterEach(() => {
    delete navigator.geolocation;
  });

  it("shows the plan's stops with planned times and work items", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({
        stops: [
          {
            id: "stop-1",
            status: "planned",
            plannedArrivalAt: "2026-08-22T09:10:00.000Z",
            plannedDepartureAt: "2026-08-22T09:20:00.000Z",
            location: { id: "loc-1", name: "Pharmacy", address: "1 Main St" },
            works: [
              {
                id: "psw-1",
                status: "planned",
                work: {
                  id: "w1",
                  title: "Pick up prescription",
                  priority: "medium",
                  durationMinutes: 10,
                },
              },
            ],
          },
        ],
      })
    );

    renderPage();

    expect(await screen.findByText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Pick up prescription")).toBeInTheDocument();
  });

  it("shows an empty state when nothing fits", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(basePlan());

    renderPage();

    expect(
      await screen.findByText("Nothing fits in this window yet.")
    ).toBeInTheDocument();
  });

  it("starts a draft plan", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(basePlan());
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue(
      basePlan({ status: "active" })
    );

    renderPage();

    fireEvent.click(await screen.findByText("Start"));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
        status: "active",
      })
    );
  });

  it("shows Complete and Abandon controls for an active plan", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({ status: "active" })
    );

    renderPage();

    expect(await screen.findByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Abandon")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/pages/PlanDetailPage.test.jsx
```

Expected: `Cannot find module './PlanDetailPage'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/pages/PlanDetailPage.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import { usePlan, useUpdatePlan } from "../modules/plan/hooks";
import { loadGoogleMaps } from "../utils/googleMaps";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

const ITEM_STATUS_TONE = {
  planned: "neutral",
  in_progress: "primary",
  done: "success",
  skipped: "warning",
};

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const { notify } = useNotifications();
  const { data: plan, isLoading } = usePlan(id);
  const updatePlanMutation = useUpdatePlan();
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const stops = plan?.stops || [];

  useEffect(() => {
    if (!googleKey || !mapRef.current || stops.length === 0) return;

    setMapError(null);
    let mapInstance;

    loadGoogleMaps(googleKey)
      .then((maps) => {
        const center = stops[0].location;
        mapInstance = new maps.Map(mapRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 12,
          disableDefaultUI: true,
        });

        const bounds = new maps.LatLngBounds();
        stops.forEach((stop, index) => {
          if (
            stop.location.latitude == null ||
            stop.location.longitude == null
          ) {
            return;
          }
          const position = {
            lat: stop.location.latitude,
            lng: stop.location.longitude,
          };
          new maps.Marker({
            position,
            map: mapInstance,
            label: String.fromCharCode(65 + (index % 26)),
            title: stop.location.name,
          });
          bounds.extend(position);
        });
        mapInstance.fitBounds(bounds, 80);
      })
      .catch((error) => {
        console.warn("Google Maps JS failed to load", error);
        setMapError(error.message || "Failed to load Google Maps");
      });

    return () => {
      mapInstance = null;
    };
  }, [googleKey, stops]);

  const handleStatusChange = async (status) => {
    try {
      await updatePlanMutation.mutateAsync({ planId: id, patch: { status } });
    } catch (error) {
      console.error("Failed to update plan status", error);
      notify(error.response?.data?.error || "Failed to update plan status");
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading plan…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Plan not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {plan.title || "Plan"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(plan.startAt)} → {formatDateTime(plan.endAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
            {plan.status}
          </Badge>
          {plan.status === "draft" && (
            <Button
              variant="primary"
              onClick={() => handleStatusChange("active")}
            >
              Start
            </Button>
          )}
          {plan.status === "active" && (
            <>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange("completed")}
              >
                Complete
              </Button>
              <Button
                variant="danger-outline"
                onClick={() => handleStatusChange("abandoned")}
              >
                Abandon
              </Button>
            </>
          )}
        </div>
      </div>

      <Card padding="lg" className="mb-6">
        {stops.length === 0 ? (
          <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
            Nothing fits in this window yet.
          </div>
        ) : googleKey ? (
          mapError ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
              {mapError}
            </div>
          ) : (
            <div
              ref={mapRef}
              className="h-80 w-full rounded-3xl border border-border"
            />
          )
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
            Configure VITE_GOOGLE_MAPS_API_KEY to see a map preview.
          </div>
        )}
      </Card>

      <div className="grid gap-4">
        {stops.map((stop, index) => (
          <Card key={stop.id} padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Stop {index + 1} · {formatDateTime(stop.plannedArrivalAt)} –{" "}
                  {formatDateTime(stop.plannedDepartureAt)}
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {stop.location.name}
                </div>
                {stop.location.address && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stop.location.address}
                  </div>
                )}
              </div>
              <Badge tone={ITEM_STATUS_TONE[stop.status] || "neutral"}>
                {stop.status}
              </Badge>
            </div>

            <div className="mt-4 grid gap-2">
              {stop.works.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface-alt p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {assignment.work.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.work.priority} priority ·{" "}
                      {assignment.work.durationMinutes} min
                    </div>
                  </div>
                  <Badge
                    tone={ITEM_STATUS_TONE[assignment.status] || "neutral"}
                  >
                    {assignment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/pages/PlanDetailPage.test.jsx
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/pages/PlanDetailPage.jsx apps/web/src/pages/PlanDetailPage.test.jsx
```

```bash
git add apps/web/src/pages/PlanDetailPage.jsx apps/web/src/pages/PlanDetailPage.test.jsx
git commit -m "Add PlanDetailPage read-only view and status controls"
```

---

### Task 6: `PlanDetailPage.jsx` — execution actions

**Files:**

- Modify: `apps/web/src/pages/PlanDetailPage.jsx`
- Test: `apps/web/src/pages/PlanDetailPage.test.jsx`

**Interfaces:**

- Consumes: `useUpdatePlanStopWork`, `useRecheckPlan` (Task 2);
  `buildGoogleMapsDirectionsUrl` from `apps/web/src/utils/googleMaps.js`
  (existing).
- Produces: per-work "Done"/"Skip" controls, a per-leg "Open in Maps" link,
  a "Re-check plan" action, and AI-variation cards with "Apply". No new
  exports — same default export as Task 5.

**Scoping note:** the backend's `POST /api/plans/:id/recheck` is the only
endpoint that returns AI variations (see the backend plan's Task 13) — the
initial `POST /api/plans` build does not. So variation cards here only ever
appear after a re-check, not immediately after creating a plan. This is a
deliberate, small scope trim from the spec's "AI-variation cards appear
after a build or recheck" (§7) wording; fetching variations separately
right after the initial build (via `POST /api/ai/plan-variations` directly)
would be a reasonable fast-follow.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/pages/PlanDetailPage.test.jsx`:

```jsx
it("marks a work item done", async () => {
  const plan = basePlan({
    status: "active",
    stops: [
      {
        id: "stop-1",
        status: "planned",
        plannedArrivalAt: "2026-08-22T09:10:00.000Z",
        plannedDepartureAt: "2026-08-22T09:20:00.000Z",
        location: { id: "loc-1", name: "Pharmacy" },
        works: [
          {
            id: "psw-1",
            status: "planned",
            work: {
              id: "w1",
              title: "Pick up prescription",
              priority: "medium",
              durationMinutes: 10,
            },
          },
        ],
      },
    ],
  });
  vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
  vi.spyOn(plansApi, "updatePlanStopWork").mockResolvedValue({
    id: "psw-1",
    status: "done",
    work: plan.stops[0].works[0].work,
  });

  renderPage();

  fireEvent.click(await screen.findByText("Done"));

  await waitFor(() =>
    expect(plansApi.updatePlanStopWork).toHaveBeenCalledWith(
      "plan-1",
      "stop-1",
      "w1",
      { status: "done" }
    )
  );
});

it("re-checks the plan using the device's current location and shows AI variations", async () => {
  navigator.geolocation = {
    getCurrentPosition: (onSuccess) =>
      onSuccess({ coords: { latitude: 1, longitude: 1 } }),
  };
  vi.spyOn(plansApi, "getPlan").mockResolvedValue(
    basePlan({ status: "active" })
  );
  vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
    plan: basePlan({ status: "active" }),
    variations: [
      {
        addWorkIds: ["w2"],
        removeWorkIds: ["w1"],
        reasoning: "Swap in the overdue errand.",
      },
    ],
  });

  renderPage();

  fireEvent.click(await screen.findByText("Re-check plan"));

  await waitFor(() =>
    expect(plansApi.recheckPlan).toHaveBeenCalledWith("plan-1", {
      latitude: 1,
      longitude: 1,
    })
  );
  expect(
    await screen.findByText("Swap in the overdue errand.")
  ).toBeInTheDocument();
});

it("applies an AI-suggested variation", async () => {
  navigator.geolocation = {
    getCurrentPosition: (onSuccess) =>
      onSuccess({ coords: { latitude: 1, longitude: 1 } }),
  };
  vi.spyOn(plansApi, "getPlan").mockResolvedValue(
    basePlan({ status: "active" })
  );
  vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
    plan: basePlan({ status: "active" }),
    variations: [
      {
        addWorkIds: ["w2"],
        removeWorkIds: ["w1"],
        reasoning: "Swap in the overdue errand.",
      },
    ],
  });
  vi.spyOn(plansApi, "updatePlan").mockResolvedValue(
    basePlan({ status: "active" })
  );

  renderPage();

  fireEvent.click(await screen.findByText("Re-check plan"));
  fireEvent.click(await screen.findByText("Apply"));

  await waitFor(() =>
    expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
      forceIncludeWorkIds: ["w2"],
      forceExcludeWorkIds: ["w1"],
    })
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run src/pages/PlanDetailPage.test.jsx
```

Expected: the three new tests fail (`"Done"`/`"Re-check plan"` text not
found).

- [ ] **Step 3: Write the implementation**

In `apps/web/src/pages/PlanDetailPage.jsx`, update the imports:

```jsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import {
  usePlan,
  useUpdatePlan,
  useUpdatePlanStopWork,
  useRecheckPlan,
} from "../modules/plan/hooks";
import {
  buildGoogleMapsDirectionsUrl,
  loadGoogleMaps,
} from "../utils/googleMaps";
```

Add state and mutations right after `const updatePlanMutation =
useUpdatePlan();`:

```jsx
const updatePlanStopWorkMutation = useUpdatePlanStopWork();
const recheckPlanMutation = useRecheckPlan();
const [variations, setVariations] = useState([]);
```

Add handlers right after `handleStatusChange`:

```jsx
const handleWorkStatusChange = async (stopId, workId, status) => {
  try {
    await updatePlanStopWorkMutation.mutateAsync({
      planId: id,
      stopId,
      workId,
      patch: { status },
    });
  } catch (error) {
    console.error("Failed to update work item", error);
    notify(error.response?.data?.error || "Failed to update work item");
  }
};

const handleRecheck = () => {
  if (!navigator.geolocation) {
    notify("Your device doesn't support location detection.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const result = await recheckPlanMutation.mutateAsync({
          planId: id,
          data: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
        setVariations(result.variations || []);
      } catch (error) {
        console.error("Failed to recheck plan", error);
        notify(error.response?.data?.error || "Failed to recheck plan");
      }
    },
    () => notify("Couldn't get your current location.")
  );
};

const handleApplyVariation = async (variation) => {
  try {
    await updatePlanMutation.mutateAsync({
      planId: id,
      patch: {
        forceIncludeWorkIds: variation.addWorkIds,
        forceExcludeWorkIds: variation.removeWorkIds,
      },
    });
    setVariations([]);
  } catch (error) {
    console.error("Failed to apply plan variation", error);
    notify(error.response?.data?.error || "Failed to apply plan variation");
  }
};

function legStartPoint(stopIndex) {
  if (stopIndex === 0) {
    return { latitude: plan.startLatitude, longitude: plan.startLongitude };
  }
  return stops[stopIndex - 1].location;
}
```

Add the "Re-check plan" button next to the existing status controls (inside
the `plan.status === "active"` block, alongside "Complete"/"Abandon"):

```jsx
{
  plan.status === "active" && (
    <>
      <Button
        variant="secondary"
        onClick={handleRecheck}
        disabled={recheckPlanMutation.isPending}
      >
        {recheckPlanMutation.isPending ? "Checking…" : "Re-check plan"}
      </Button>
      <Button
        variant="secondary"
        onClick={() => handleStatusChange("completed")}
      >
        Complete
      </Button>
      <Button
        variant="danger-outline"
        onClick={() => handleStatusChange("abandoned")}
      >
        Abandon
      </Button>
    </>
  );
}
```

Add the variation cards right after the map `<Card>` and before the stop
list `<div className="grid gap-4">`:

```jsx
{
  variations.length > 0 && (
    <div className="mb-6 grid gap-3">
      {variations.map((variation, index) => (
        <Card key={index} padding="md" className="border-accent/30 bg-accent/5">
          <p className="text-sm text-foreground">{variation.reasoning}</p>
          <div className="mt-2 flex justify-end">
            <Button
              variant="accent"
              size="sm"
              onClick={() => handleApplyVariation(variation)}
            >
              Apply
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

Inside the stop-mapping loop, add the "Open in Maps" link and the
per-work-item Done/Skip controls (replacing the read-only `works.map` block
from Task 5 with this one):

```jsx
<div className="mt-3">
  <a
    href={buildGoogleMapsDirectionsUrl(legStartPoint(index), [stop])}
    target="_blank"
    rel="noreferrer"
    className="text-sm font-semibold text-primary hover:underline"
  >
    Open in Maps
  </a>
</div>

<div className="mt-4 grid gap-2">
  {stop.works.map((assignment) => (
    <div
      key={assignment.id}
      className="flex items-center justify-between gap-3 rounded-2xl bg-surface-alt p-3"
    >
      <div>
        <div className="font-medium text-foreground">{assignment.work.title}</div>
        <div className="text-sm text-muted-foreground">
          {assignment.work.priority} priority · {assignment.work.durationMinutes} min
        </div>
      </div>
      {assignment.status === "planned" ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              handleWorkStatusChange(stop.id, assignment.work.id, "skipped")
            }
          >
            Skip
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              handleWorkStatusChange(stop.id, assignment.work.id, "done")
            }
          >
            Done
          </Button>
        </div>
      ) : (
        <Badge tone={ITEM_STATUS_TONE[assignment.status] || "neutral"}>
          {assignment.status}
        </Badge>
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/pages/PlanDetailPage.test.jsx
```

Expected: all `PlanDetailPage.test.jsx` tests pass (Task 5's + Task 6's).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/web/src/pages/PlanDetailPage.jsx apps/web/src/pages/PlanDetailPage.test.jsx
```

```bash
git add apps/web/src/pages/PlanDetailPage.jsx apps/web/src/pages/PlanDetailPage.test.jsx
git commit -m "Add PlanDetailPage execution actions: done/skip, recheck, AI variations"
```

---

### Task 7: Wire the routes, retire `PlannerPage`, remove now-dead `optimize-route`, final verification

**Files:**

- Modify: `apps/web/src/routes.jsx`
- Delete: `apps/web/src/pages/PlannerPage.jsx`, `apps/web/src/pages/PlannerPage.test.jsx`
- Modify: `apps/web/src/modules/ai/hooks.js`, `apps/web/src/modules/ai/hooks.test.jsx`
- Modify: `apps/web/src/api/ai.js`, `apps/web/src/api/ai.test.js`
- Modify: `apps/api/src/routes/ai.js`, `apps/api/test/ai.test.js`

**Interfaces:**

- Consumes: `PlansListPage` (Task 4), `PlanDetailPage` (Task 6).
- Produces: nothing new — this task only wires and cleans up.

**Why the `optimize-route` cleanup belongs here:** `PlannerPage.jsx` was
the _only_ caller of `useOptimizeRoute`/`optimizeRoute`/`POST
/api/ai/optimize-route` (the plan-based builder replaces manual route
reordering with its own scheduling). Once this task deletes `PlannerPage`,
that whole call chain becomes dead code with no other consumer — leaving it
in place would be exactly the kind of half-finished, orphaned code this
project avoids. This is the right task to remove it in, since only after
`PlannerPage.jsx` is gone is it actually unused.

- [ ] **Step 1: Update the router**

In `apps/web/src/routes.jsx`, replace the `PlannerPage` import and route
with the two new pages (the nav labels/links stay "Planner" pointing at
`/planner` — only what renders there changes):

```jsx
import Dashboard from "./pages/Dashboard";
import IntentPage from "./pages/IntentPage";
import PlansListPage from "./pages/PlansListPage";
import PlanDetailPage from "./pages/PlanDetailPage";
```

```jsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/intent/:id" element={<IntentPage />} />
  <Route path="/planner" element={<PlansListPage />} />
  <Route path="/plan/:id" element={<PlanDetailPage />} />
</Routes>
```

- [ ] **Step 2: Delete the old planner page and its test**

```bash
git rm apps/web/src/pages/PlannerPage.jsx apps/web/src/pages/PlannerPage.test.jsx
```

- [ ] **Step 3: Remove the now-dead `optimize-route` frontend code**

In `apps/web/src/modules/ai/hooks.js`, remove the `optimizeRoute` import and
the `useOptimizeRoute` export:

```js
// Remove this import line:
// optimizeRoute,

// Remove this whole export:
// export function useOptimizeRoute() {
//   return useMutation({
//     mutationFn: ({ startPoint, stops }) => optimizeRoute(startPoint, stops),
//   });
// }
```

In `apps/web/src/modules/ai/hooks.test.jsx`, remove the `describe("useOptimizeRoute", ...)` block and its now-unused `useOptimizeRoute` import.

In `apps/web/src/api/ai.js`, remove the `optimizeRoute` export:

```js
// Remove this whole function:
// export async function optimizeRoute(startPoint, stops) {
//   const response = await apiClient.post("/api/ai/optimize-route", {
//     startPoint,
//     stops,
//   });
//   return response.data;
// }
```

In `apps/web/src/api/ai.test.js`, remove the `describe("optimizeRoute", ...)` block and its now-unused `optimizeRoute` import.

- [ ] **Step 4: Remove the now-dead `optimize-route` backend route**

In `apps/api/src/routes/ai.js`, remove `OPTIMIZE_ROUTE_SYSTEM_PROMPT`,
`buildOptimizeRouteUserPrompt`, `sanitizeOptimizedRoute`, and the
`router.post("/optimize-route", ...)` handler in their entirety (the whole
block between the `SUGGEST_PLACE_TYPES` route and the `SPLIT_INTENT_SYSTEM_PROMPT`
declaration).

In `apps/api/test/ai.test.js`, remove every `test("POST /api/ai/optimize-route ...", ...)` block.

- [ ] **Step 5: Run both full test suites**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npx vitest run
cd ../api
npm test
```

Expected: every test passes (no leftover references to the removed
functions/routes anywhere).

- [ ] **Step 6: Full verification before opening the PR**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/web
npm run lint
npm run build
cd ../api
npm run lint
npm test
cd ../..
npx prettier --check apps/web/src apps/api/src apps/api/test
```

Fix anything flagged.

- [ ] **Step 7: Commit, push, open the PR**

```bash
git add apps/web/src/routes.jsx apps/web/src/modules/ai/hooks.js apps/web/src/modules/ai/hooks.test.jsx apps/web/src/api/ai.js apps/web/src/api/ai.test.js apps/api/src/routes/ai.js apps/api/test/ai.test.js
git commit -m "Wire plan pages into routing; retire PlannerPage and optimize-route"
git push -u origin feat/plan-based-planner-frontend
```

```bash
gh pr create --title "Add plan-based planner frontend" --body "$(cat <<'EOF'
## Summary
- Adds PlansListPage (list + create) and PlanDetailPage (map, ordered
  stops, execution controls, re-check, AI-variation cards) against the
  already-merged /api/plans backend.
- Retires PlannerPage.jsx and the now-unused optimize-route AI route (its
  only caller).
- See docs/superpowers/specs/2026-08-22-plan-based-planner-design.md.

## Test plan
- [x] npx vitest run (apps/web) — all passing
- [x] npm test (apps/api) — all passing
- [x] npm run lint (both workspaces) — clean
- [x] npm run build (apps/web) — succeeds
- [x] npx prettier --check — clean
- [ ] Manual: create a plan, start it, mark a stop's work done/skipped,
      re-check with a different location, apply a variation
EOF
)"
```

```bash
gh pr checks <N> --watch
```

Once green:

```bash
gh pr merge <N> --squash --delete-branch
git checkout main
git pull
```

---

## Self-Review Notes

- **Spec coverage:** §7 (frontend) → Tasks 1–7. §5 (AI variations UI) →
  Task 6, with the scoping note about recheck-only variations called out
  explicitly rather than silently under-delivered. §6 (API surface, client
  side) → Task 1. The `WorkFormModal` priority selector implied by making
  `Work.priority` useful is explicitly flagged as an out-of-scope known gap
  in Global Constraints, not silently dropped.
- **Placeholder scan:** no TBDs; every step has real, runnable code, except
  Task 7's Steps 3–4 which are deletions (removing named
  functions/blocks is unambiguous without reproducing the deleted code).
- **Type consistency:** `PlanLocationPicker`'s `value` shape (`{dateTime,
label, latitude, longitude}`) is identical across Tasks 3, 4; the plan
  detail cache shape consumed by `useUpdatePlanStop`/`useUpdatePlanStopWork`
  (Task 2) matches exactly what `PlanDetailPage` (Tasks 5–6) reads and
  renders (`stops[].works[].work`, `stops[].works[].status`); `formatDateTime`
  from Task 5 is reused as-is (not redefined) by Task 6.
