import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as aiApi from "../../api/ai";
import * as googleMaps from "../../utils/googleMaps";
import LocationOptionGroupsEditor from "./LocationOptionGroupsEditor";

function baseProps(overrides = {}) {
  return {
    groups: [{ id: null, title: "Option 1", locations: [] }],
    selectedGroupIndex: 0,
    onSelectGroup: vi.fn(),
    onAddGroup: vi.fn(),
    onRenameGroup: vi.fn(),
    onRemoveGroup: vi.fn(),
    onAddLocationToGroup: vi.fn(),
    onRemoveLocationFromGroup: vi.fn(),
    ...overrides,
  };
}

describe("LocationOptionGroupsEditor — Suggest place types", () => {
  beforeEach(() => {
    // The real key only exists in the local, gitignored .env — stub it so
    // this test doesn't depend on that (CI has none, so googleKey would
    // otherwise be undefined and handleSearchPlaces would short-circuit).
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-maps-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not show the suggest button when there's no work title", () => {
    renderWithProviders(
      <LocationOptionGroupsEditor {...baseProps({ workTitle: "" })} />
    );

    expect(
      screen.queryByText("✨ Suggest place types")
    ).not.toBeInTheDocument();
  });

  it("fetches suggestions and lets you use one to search", async () => {
    vi.spyOn(aiApi, "suggestPlaceTypes").mockResolvedValue({
      suggestions: ["pharmacy", "drugstore"],
    });
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      {
        name: "Corner Pharmacy",
        formattedAddress: "123 Main St",
        latitude: 1,
        longitude: 1,
        placeId: "place-1",
      },
    ]);

    renderWithProviders(
      <LocationOptionGroupsEditor
        {...baseProps({
          workTitle: "Pick up prescription",
          workNotes: "ask for generic",
        })}
      />
    );

    fireEvent.click(screen.getByText("✨ Suggest place types"));

    await waitFor(() =>
      expect(aiApi.suggestPlaceTypes).toHaveBeenCalledWith(
        "Pick up prescription",
        "ask for generic"
      )
    );

    const pharmacyChip = await screen.findByText("pharmacy");
    fireEvent.click(pharmacyChip);

    await waitFor(() => expect(googleMaps.searchPlaces).toHaveBeenCalled());
    const [query, , nearLocation] = googleMaps.searchPlaces.mock.calls[0];
    expect(query).toBe("pharmacy");
    expect(nearLocation).toBe(null);
    expect(await screen.findByText("Corner Pharmacy")).toBeInTheDocument();
  });
});
