import { fireEvent, render, screen } from "@testing-library/react";
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
