import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as intentsApi from "../api/intents";
import * as workApi from "../api/work";
import * as plansApi from "../api/plans";
import IntentPage from "./IntentPage";

vi.mock("../modules/work/WorkFormModal", () => ({
  default: ({ work, intentId, onClose }) => (
    <div data-testid="work-form-modal">
      <div data-testid="work-form-modal-intent-id">{intentId}</div>
      <div data-testid="work-form-modal-target">
        {work ? work.title : "new"}
      </div>
      <button type="button" onClick={onClose}>
        Close modal
      </button>
    </div>
  ),
}));

function buildWork(overrides = {}) {
  return {
    id: "work-1",
    title: "Buy groceries",
    notes: "",
    durationMinutes: 30,
    status: "todo",
    locationOptions: [],
    selectedLocationOptionId: null,
    ...overrides,
  };
}

function buildIntent(overrides = {}) {
  return {
    id: "intent-1",
    title: "Plan the trip",
    description: "",
    priority: "medium",
    status: "active",
    startDate: null,
    dueDate: null,
    workItems: [],
    ...overrides,
  };
}

function renderIntentPage(intent) {
  vi.spyOn(intentsApi, "getIntent").mockResolvedValue(intent);
  if (!vi.isMockFunction(plansApi.getPlans)) {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
  }
  return renderWithProviders(
    <Routes>
      <Route path="/intent/:id" element={<IntentPage />} />
      <Route path="/planner" element={<div>Planner stub</div>} />
      <Route path="/plan/:id" element={<div>Plan detail stub</div>} />
    </Routes>,
    { route: `/intent/${intent.id}` }
  );
}

describe("IntentPage", () => {
  it("renders the intent summary and its work items", async () => {
    renderIntentPage(
      buildIntent({
        title: "Plan the trip",
        description: "Book everything",
        workItems: [buildWork({ title: "Buy groceries" })],
      })
    );

    expect(
      await screen.findByDisplayValue("Plan the trip")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Book everything")).toBeInTheDocument();
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
  });

  it("creates a work item from the quick-add bar", async () => {
    vi.spyOn(workApi, "createWorkItem").mockResolvedValue(buildWork());
    renderIntentPage(buildIntent());

    await screen.findByDisplayValue("Plan the trip");
    fireEvent.change(screen.getByPlaceholderText("What needs to happen?"), {
      target: { value: "Buy groceries" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(workApi.createWorkItem).toHaveBeenCalled());
    expect(workApi.createWorkItem.mock.calls[0][0]).toEqual(
      expect.objectContaining({ title: "Buy groceries", intentId: "intent-1" })
    );
  });

  it("opens the create-work modal from + Add details", async () => {
    renderIntentPage(buildIntent());

    await screen.findByDisplayValue("Plan the trip");
    fireEvent.click(
      screen.getByText("+ Add details (duration, notes, location)")
    );

    expect(await screen.findByTestId("work-form-modal")).toBeInTheDocument();
    expect(screen.getByTestId("work-form-modal-target")).toHaveTextContent(
      "new"
    );
  });

  it("opens the edit modal for a work item when its row is clicked", async () => {
    renderIntentPage(
      buildIntent({ workItems: [buildWork({ title: "Buy groceries" })] })
    );

    fireEvent.click(await screen.findByText("Buy groceries"));

    expect(await screen.findByTestId("work-form-modal")).toBeInTheDocument();
    expect(screen.getByTestId("work-form-modal-target")).toHaveTextContent(
      "Buy groceries"
    );
    expect(screen.getByTestId("work-form-modal-intent-id")).toHaveTextContent(
      "intent-1"
    );
  });

  it("cycles work status from the row's badge without opening the modal", async () => {
    vi.spyOn(workApi, "updateWorkItem").mockResolvedValue(
      buildWork({ status: "in_progress" })
    );
    renderIntentPage(
      buildIntent({
        workItems: [buildWork({ title: "Buy groceries", status: "todo" })],
      })
    );

    fireEvent.click(await screen.findByText("todo"));

    await waitFor(() =>
      expect(workApi.updateWorkItem).toHaveBeenCalledWith("work-1", {
        status: "in_progress",
      })
    );
    expect(screen.queryByTestId("work-form-modal")).not.toBeInTheDocument();
  });

  it("deletes a work item after confirmation", async () => {
    vi.spyOn(workApi, "deleteWorkItem").mockResolvedValue();
    renderIntentPage(
      buildIntent({ workItems: [buildWork({ title: "Buy groceries" })] })
    );

    fireEvent.click(await screen.findByLabelText("Delete Buy groceries"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(workApi.deleteWorkItem).toHaveBeenCalledWith("work-1")
    );
  });

  it("shows a summary line and the places to visit derived from chosen options", async () => {
    renderIntentPage(
      buildIntent({
        workItems: [
          buildWork({
            title: "Buy groceries",
            durationMinutes: 45,
            status: "done",
            locationOptions: [
              {
                id: "option-1",
                title: "Option 1",
                locations: [
                  { id: "loc-1", name: "Trader Joe's", address: "1 Main St" },
                ],
              },
            ],
            selectedLocationOptionId: "option-1",
          }),
        ],
      })
    );

    await screen.findByText("Buy groceries");
    expect(screen.getByText("1 work · 1 done · 45 min")).toBeInTheDocument();
    expect(screen.getByText("Places to visit (1)")).toBeInTheDocument();
    expect(screen.getByText("Trader Joe's")).toBeInTheDocument();
  });

  it("opens the priority/status/dates modal and persists a priority change", async () => {
    vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
    renderIntentPage(buildIntent());

    await screen.findByDisplayValue("Plan the trip");
    fireEvent.click(screen.getByLabelText("Edit priority, status, and dates"));

    const dialog = await screen.findByRole("dialog", {
      name: "Priority, status & dates",
    });
    const [prioritySelect] = within(dialog).getAllByRole("combobox");
    fireEvent.change(prioritySelect, { target: { value: "high" } });

    await waitFor(() =>
      expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
        priority: "high",
      })
    );
  });

  it("offers to create a new plan or add to an existing one when 'Plan this Intent' is clicked", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([
      { id: "plan-1", title: "Saturday errands", status: "draft", stops: [] },
    ]);
    renderIntentPage(
      buildIntent({ workItems: [buildWork({ title: "Buy groceries" })] })
    );

    fireEvent.click(await screen.findByText("Buy groceries"));
    fireEvent.click(screen.getByText("Close modal"));
    fireEvent.click(screen.getByText("Plan this Intent"));

    const dialog = await screen.findByRole("dialog", {
      name: "Plan this Intent",
    });
    expect(within(dialog).getByText("+ Create a new plan")).toBeInTheDocument();
    expect(within(dialog).getByText("Saturday errands")).toBeInTheDocument();
  });

  it("navigates to the planner with the intent id when creating a new plan", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    renderIntentPage(
      buildIntent({ workItems: [buildWork({ title: "Buy groceries" })] })
    );

    fireEvent.click(await screen.findByText("Plan this Intent"));
    fireEvent.click(await screen.findByText("+ Create a new plan"));

    expect(await screen.findByText("Planner stub")).toBeInTheDocument();
  });

  it("adds the intent's work to an existing plan and navigates to it", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([
      { id: "plan-1", title: "Saturday errands", status: "draft", stops: [] },
    ]);
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue({
      id: "plan-1",
      title: "Saturday errands",
      status: "draft",
      stops: [],
    });
    renderIntentPage(
      buildIntent({ workItems: [buildWork({ title: "Buy groceries" })] })
    );

    fireEvent.click(await screen.findByText("Plan this Intent"));
    fireEvent.click(await screen.findByText("Saturday errands"));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
        forceIncludeWorkIds: ["work-1"],
      })
    );
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });

  it("tells the user there is nothing to plan when all work is done", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    renderIntentPage(
      buildIntent({
        workItems: [buildWork({ title: "Buy groceries", status: "done" })],
      })
    );

    fireEvent.click(await screen.findByText("Plan this Intent"));

    expect(
      await screen.findByText("This intent has no remaining work to plan.")
    ).toBeInTheDocument();
  });
});
