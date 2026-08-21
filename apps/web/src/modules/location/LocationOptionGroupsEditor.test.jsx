import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

    expect(screen.queryByText(/✨/)).not.toBeInTheDocument();
  });

  it("automatically fetches both kinds of suggestions and lets you use either to search", async () => {
    vi.spyOn(aiApi, "suggestPlaceTypes").mockResolvedValue({
      types: ["pharmacy", "drugstore"],
      names: ["CVS", "Walgreens"],
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

    // Fetched automatically, no click needed.
    await waitFor(() =>
      expect(aiApi.suggestPlaceTypes).toHaveBeenCalledWith(
        "Pick up prescription",
        "ask for generic"
      )
    );

    await screen.findByText("Specific places to try");
    expect(await screen.findByText("CVS")).toBeInTheDocument();
    expect(screen.getByText("Walgreens")).toBeInTheDocument();
    expect(screen.getByText("Categories to search")).toBeInTheDocument();

    const pharmacyChip = await screen.findByText("pharmacy");
    fireEvent.click(pharmacyChip);

    await waitFor(() => expect(googleMaps.searchPlaces).toHaveBeenCalled());
    const [query, , nearLocation] = googleMaps.searchPlaces.mock.calls[0];
    expect(query).toBe("pharmacy");
    expect(nearLocation).toBe(null);
    expect(await screen.findByText("Corner Pharmacy")).toBeInTheDocument();
  });
});

describe("LocationOptionGroupsEditor — results list and map tabs", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-maps-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
    delete navigator.geolocation;
  });

  it("shows distance and opening hours for each result, list tab active by default", async () => {
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 0, longitude: 0 } }),
    };
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      {
        name: "Corner Pharmacy",
        formattedAddress: "123 Main St",
        latitude: 0,
        longitude: 1,
        placeId: "place-1",
        openingHours: ["Monday: 9:00 AM – 5:00 PM"],
      },
    ]);

    renderWithProviders(<LocationOptionGroupsEditor {...baseProps()} />);

    await waitFor(() =>
      expect(
        screen.getByText("📍 Showing results near your current location")
      ).toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText("Search for a place"), {
      target: { value: "pharmacy" },
    });
    fireEvent.click(screen.getByText("Search", { selector: "button" }));

    await screen.findByText("Corner Pharmacy");
    expect(screen.getByText("List (1)")).toHaveClass("bg-primary");
    expect(screen.getByText("Map")).not.toHaveClass("bg-primary");
    expect(screen.getByText(/km away|mi away/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Hours"));
    expect(screen.getByText("Monday: 9:00 AM – 5:00 PM")).toBeInTheDocument();
  });

  it("switches to the map tab when Preview is clicked", async () => {
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      {
        name: "Corner Pharmacy",
        formattedAddress: "123 Main St",
        latitude: 1,
        longitude: 1,
        placeId: "place-1",
      },
    ]);

    renderWithProviders(<LocationOptionGroupsEditor {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText("Search for a place"), {
      target: { value: "pharmacy" },
    });
    fireEvent.click(screen.getByText("Search", { selector: "button" }));

    fireEvent.click(await screen.findByText("Preview"));
    expect(screen.getByText("Map")).toHaveClass("bg-primary");
  });
});

describe("LocationOptionGroupsEditor — search location picker", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-maps-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  it("lets the user search for and set a manual search location", async () => {
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      {
        name: "Downtown",
        formattedAddress: "Downtown, Some City",
        latitude: 10,
        longitude: 20,
        placeId: "place-downtown",
      },
    ]);

    renderWithProviders(<LocationOptionGroupsEditor {...baseProps()} />);

    expect(screen.getByText("Searching everywhere.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Detect my location" }));
    const pickerInput = screen.getByPlaceholderText("Search a city or address");
    fireEvent.change(pickerInput, { target: { value: "Downtown" } });
    fireEvent.click(within(pickerInput.closest("form")).getByText("Search"));

    fireEvent.click(await screen.findByText("Downtown"));

    expect(
      await screen.findByText(/Showing results near Downtown/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change search location" })
    ).toBeInTheDocument();
  });
});

describe("LocationOptionGroupsEditor — hideGroupManagement", () => {
  it("hides per-group chrome for a single group but still lists its places", () => {
    renderWithProviders(
      <LocationOptionGroupsEditor
        {...baseProps({
          hideGroupManagement: true,
          groups: [
            {
              id: "group-1",
              title: "Option 1",
              locations: [{ id: "loc-1", name: "Trader Joe's" }],
            },
          ],
        })}
      />
    );

    expect(screen.getByText("Trader Joe's")).toBeInTheDocument();
    expect(screen.queryByText("Existing group")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove group")).not.toBeInTheDocument();
    expect(screen.getByText("+ Add alternate option")).toBeInTheDocument();
  });

  it("calls onAddGroup when adding an alternate option", () => {
    const onAddGroup = vi.fn();
    renderWithProviders(
      <LocationOptionGroupsEditor
        {...baseProps({
          hideGroupManagement: true,
          onAddGroup,
          groups: [{ id: "group-1", title: "Option 1", locations: [] }],
        })}
      />
    );

    fireEvent.click(screen.getByText("+ Add alternate option"));
    expect(onAddGroup).toHaveBeenCalled();
  });

  it("shows full group chrome again once there are two groups", () => {
    renderWithProviders(
      <LocationOptionGroupsEditor
        {...baseProps({
          hideGroupManagement: true,
          groups: [
            { id: "group-1", title: "Option 1", locations: [] },
            { id: "group-2", title: "Option 2", locations: [] },
          ],
        })}
      />
    );

    expect(screen.getAllByText("Remove group")).toHaveLength(2);
  });
});
