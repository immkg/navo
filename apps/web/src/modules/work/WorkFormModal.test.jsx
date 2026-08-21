import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as workApi from "../../api/work";
import * as aiApi from "../../api/ai";
import * as googleMaps from "../../utils/googleMaps";
import WorkFormModal from "./WorkFormModal";

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

describe("WorkFormModal", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.spyOn(aiApi, "suggestPlaceTypes").mockResolvedValue({
      types: [],
      names: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("create mode", () => {
    it("creates a work item from just a title", async () => {
      vi.spyOn(workApi, "createWorkItem").mockResolvedValue(buildWork());
      const onClose = vi.fn();

      renderWithProviders(
        <WorkFormModal open onClose={onClose} intentId="intent-1" work={null} />
      );

      expect(
        screen.getByRole("heading", { name: "Add Work" })
      ).toBeInTheDocument();

      fireEvent.change(
        screen.getByPlaceholderText(
          "Buy ingredients, call electrician, review document"
        ),
        { target: { value: "Buy groceries" } }
      );
      fireEvent.click(screen.getByRole("button", { name: "Add Work" }));

      await waitFor(() => expect(workApi.createWorkItem).toHaveBeenCalled());
      // createWorkItem is the mutationFn passed by direct reference, so
      // TanStack Query calls it with a second (context) argument — assert
      // on the first positional argument only.
      expect(workApi.createWorkItem.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          title: "Buy groceries",
          intentId: "intent-1",
        })
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("includes locally-added places in the create payload", async () => {
      vi.spyOn(workApi, "createWorkItem").mockResolvedValue(buildWork());
      vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
        {
          name: "Trader Joe's",
          formattedAddress: "1 Main St",
          latitude: 1,
          longitude: 1,
          placeId: "place-1",
        },
      ]);

      renderWithProviders(
        <WorkFormModal open onClose={vi.fn()} intentId="intent-1" work={null} />
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Buy ingredients, call electrician, review document"
        ),
        { target: { value: "Buy groceries" } }
      );
      fireEvent.change(screen.getByPlaceholderText("Search for a place"), {
        target: { value: "Trader Joe's" },
      });
      fireEvent.click(screen.getByText("Search"));
      fireEvent.click(await screen.findByText("Add"));
      fireEvent.click(screen.getByRole("button", { name: "Add Work" }));

      await waitFor(() => expect(workApi.createWorkItem).toHaveBeenCalled());
      expect(workApi.createWorkItem.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          locationOptions: [
            expect.objectContaining({
              locations: [expect.objectContaining({ name: "Trader Joe's" })],
            }),
          ],
        })
      );
    });
  });

  describe("edit mode", () => {
    it("pre-fills existing values and saves changes", async () => {
      vi.spyOn(workApi, "updateWorkItem").mockResolvedValue(
        buildWork({ title: "Buy groceries and cook" })
      );

      renderWithProviders(
        <WorkFormModal
          open
          onClose={vi.fn()}
          intentId="intent-1"
          work={buildWork()}
        />
      );

      expect(screen.getByText("Edit Work")).toBeInTheDocument();
      const titleInput = screen.getByDisplayValue("Buy groceries");
      fireEvent.change(titleInput, {
        target: { value: "Buy groceries and cook" },
      });
      fireEvent.click(screen.getByText("Save changes"));

      await waitFor(() =>
        expect(workApi.updateWorkItem).toHaveBeenCalledWith(
          "work-1",
          expect.objectContaining({ title: "Buy groceries and cook" })
        )
      );
    });

    it("asks for confirmation and deletes the work item", async () => {
      vi.spyOn(workApi, "deleteWorkItem").mockResolvedValue();
      const onClose = vi.fn();

      renderWithProviders(
        <WorkFormModal
          open
          onClose={onClose}
          intentId="intent-1"
          work={buildWork()}
        />
      );

      fireEvent.click(screen.getByText("Delete"));
      const confirmDialog = await screen.findByRole("dialog", {
        name: "Delete work item?",
      });
      fireEvent.click(
        within(confirmDialog).getByRole("button", { name: "Delete" })
      );

      await waitFor(() =>
        expect(workApi.deleteWorkItem).toHaveBeenCalledWith("work-1")
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("persists a place added to an existing location group immediately", async () => {
      const existingWork = buildWork({
        locationOptions: [{ id: "option-1", title: "Option 1", locations: [] }],
        selectedLocationOptionId: "option-1",
      });
      vi.spyOn(workApi, "addLocationToOption").mockResolvedValue({
        id: "option-1",
        title: "Option 1",
        locations: [{ id: "loc-1", name: "Trader Joe's" }],
      });
      vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
        {
          name: "Trader Joe's",
          formattedAddress: "1 Main St",
          latitude: 1,
          longitude: 1,
          placeId: "place-1",
        },
      ]);

      renderWithProviders(
        <WorkFormModal
          open
          onClose={vi.fn()}
          intentId="intent-1"
          work={existingWork}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("Search for a place"), {
        target: { value: "Trader Joe's" },
      });
      fireEvent.click(screen.getByText("Search"));
      fireEvent.click(await screen.findByText("Add"));

      await waitFor(() =>
        expect(workApi.addLocationToOption).toHaveBeenCalledWith(
          "work-1",
          "option-1",
          expect.objectContaining({ name: "Trader Joe's" })
        )
      );
    });

    it("reveals full group management after adding an alternate option", () => {
      renderWithProviders(
        <WorkFormModal
          open
          onClose={vi.fn()}
          intentId="intent-1"
          work={buildWork({
            locationOptions: [
              { id: "option-1", title: "Option 1", locations: [] },
            ],
          })}
        />
      );

      expect(screen.queryByText("Remove group")).not.toBeInTheDocument();
      fireEvent.click(screen.getByText("+ Add alternate option"));
      expect(screen.getAllByText("Remove group")).toHaveLength(2);
    });
  });
});
