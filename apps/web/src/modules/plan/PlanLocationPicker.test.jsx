import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as googleMaps from "../../utils/googleMaps";
import PlanLocationPicker from "./PlanLocationPicker";

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

  it("detects the device's current location via the icon inside the search field", async () => {
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

    fireEvent.click(screen.getByLabelText("Use current location"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 12,
          longitude: 34,
          label: "Current location",
        })
      )
    );
  });

  it("autofills the search field with the reverse-geocoded address after detecting current location", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 12, longitude: 34 } }),
    };
    vi.spyOn(googleMaps, "reverseGeocodeLocation").mockResolvedValue({
      label: "123 Main St, Some City",
      placeId: "place-reverse",
    });

    render(
      <PlanLocationPicker
        legend="Start"
        value={{
          dateTime: "2026-08-22T09:00",
          label: "",
          latitude: null,
          longitude: null,
        }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Use current location"));

    expect(
      await screen.findByDisplayValue("123 Main St, Some City")
    ).toBeInTheDocument();
  });

  it("auto-detects current location on mount when autoDetectOnMount is set and no value exists yet", async () => {
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
        autoDetectOnMount
      />
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 12, longitude: 34 })
      )
    );
  });

  it("does not auto-detect when a value already exists, even with autoDetectOnMount set", () => {
    const onChange = vi.fn();
    navigator.geolocation = {
      getCurrentPosition: vi.fn(),
    };

    render(
      <PlanLocationPicker
        legend="Start"
        value={{
          dateTime: "2026-08-22T09:00",
          label: "Somewhere",
          latitude: 5,
          longitude: 6,
        }}
        onChange={onChange}
        autoDetectOnMount
      />
    );

    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
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

  it("searches when Enter is pressed in the search field", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    vi.spyOn(googleMaps, "searchPlaces").mockResolvedValue([
      { name: "Downtown", formattedAddress: "Downtown, Some City" },
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
        onChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search a city or address"), {
      target: { value: "Downtown" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Search a city or address"), {
      key: "Enter",
    });

    expect(await screen.findByText("Downtown")).toBeInTheDocument();
  });

  it("renders no nested <form> when used inside the caller's own form", () => {
    const { container } = render(
      <form>
        <PlanLocationPicker
          legend="Start"
          value={{
            dateTime: "2026-08-22T09:00",
            label: "",
            latitude: null,
            longitude: null,
          }}
          onChange={vi.fn()}
        />
      </form>
    );

    expect(container.querySelectorAll("form")).toHaveLength(1);
  });

  it("accepts a valid manually-entered latitude/longitude", () => {
    const onChange = vi.fn();
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

    fireEvent.click(screen.getByText("Enter coordinates manually"));
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "12.5" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "-45.5" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 12.5 })
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ longitude: -45.5 })
    );
  });

  it("rejects an out-of-range manually-entered latitude without calling onChange", () => {
    const onChange = vi.fn();
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

    fireEvent.click(screen.getByText("Enter coordinates manually"));
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "200" },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Latitude must be between -90 and 90, longitude between -180 and 180."
      )
    ).toBeInTheDocument();
  });

  it("rejects an out-of-range manually-entered longitude without calling onChange", () => {
    const onChange = vi.fn();
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

    fireEvent.click(screen.getByText("Enter coordinates manually"));
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "-200" },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Latitude must be between -90 and 90, longitude between -180 and 180."
      )
    ).toBeInTheDocument();
  });
});
