import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import { intentQueryKey } from "../intents/hooks";
import { WORK_QUERY_KEY } from "../work/hooks";
import * as workApi from "../../api/work";
import {
  useAddLocationToOption,
  useCreateLocationOption,
  useCurrentLocation,
  useDeleteLocationOption,
  useRemoveLocationFromOption,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCreateLocationOption", () => {
  it("appends the new option into the work item wherever it's cached, without changing the selection", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      { id: "w1", locationOptions: [], selectedLocationOptionId: null },
    ]);
    queryClient.setQueryData(intentQueryKey("intent-1"), {
      id: "intent-1",
      workItems: [
        { id: "w1", locationOptions: [], selectedLocationOptionId: null },
      ],
    });
    vi.spyOn(workApi, "createLocationOption").mockResolvedValue({ id: "opt1" });

    const { result } = renderHook(() => useCreateLocationOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        workId: "w1",
        data: { locations: [] },
      });
    });

    const flat = queryClient.getQueryData(WORK_QUERY_KEY)[0];
    expect(flat.locationOptions).toEqual([{ id: "opt1" }]);
    // Adding an option never auto-selects it — the user chooses explicitly.
    expect(flat.selectedLocationOptionId).toBe(null);

    const nested = queryClient.getQueryData(intentQueryKey("intent-1"))
      .workItems[0];
    expect(nested.locationOptions).toEqual([{ id: "opt1" }]);
    expect(nested.selectedLocationOptionId).toBe(null);
  });
});

describe("useDeleteLocationOption", () => {
  it("removes the option and applies the server's reassigned selection", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      {
        id: "w1",
        locationOptions: [{ id: "opt0" }, { id: "opt1" }],
        selectedLocationOptionId: "opt0",
      },
    ]);
    vi.spyOn(workApi, "deleteLocationOption").mockResolvedValue({
      deletedOptionId: "opt0",
      selectedLocationOptionId: "opt1",
    });

    const { result } = renderHook(() => useDeleteLocationOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", optionId: "opt0" });
    });

    const updated = queryClient.getQueryData(WORK_QUERY_KEY)[0];
    expect(updated.locationOptions).toEqual([{ id: "opt1" }]);
    expect(updated.selectedLocationOptionId).toBe("opt1");
  });
});

describe("useAddLocationToOption / useRemoveLocationFromOption", () => {
  it("replaces the option's locations wherever the work item is cached", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      { id: "w1", locationOptions: [{ id: "opt0", locations: [] }] },
    ]);
    vi.spyOn(workApi, "addLocationToOption").mockResolvedValue({
      id: "opt0",
      locations: [{ id: "loc1" }],
    });

    const { result } = renderHook(() => useAddLocationToOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        workId: "w1",
        optionId: "opt0",
        data: { name: "A place" },
      });
    });

    expect(
      queryClient.getQueryData(WORK_QUERY_KEY)[0].locationOptions[0].locations
    ).toEqual([{ id: "loc1" }]);
  });

  it("removeLocationFromOption also replaces the option in cache", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      {
        id: "w1",
        locationOptions: [{ id: "opt0", locations: [{ id: "loc1" }] }],
      },
    ]);
    vi.spyOn(workApi, "removeLocationFromOption").mockResolvedValue({
      id: "opt0",
      locations: [],
    });

    const { result } = renderHook(() => useRemoveLocationFromOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        workId: "w1",
        optionId: "opt0",
        locationId: "loc1",
      });
    });

    expect(
      queryClient.getQueryData(WORK_QUERY_KEY)[0].locationOptions[0].locations
    ).toEqual([]);
  });
});

describe("useCurrentLocation", () => {
  afterEach(() => {
    delete navigator.geolocation;
  });

  it("reports unsupported when the browser has no geolocation API", () => {
    delete navigator.geolocation;

    const { result } = renderHook(() => useCurrentLocation());

    expect(result.current.status).toBe("unsupported");
  });

  it("reports success with coordinates once geolocation resolves", async () => {
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 12.34, longitude: 56.78 } }),
    };

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.latitude).toBe(12.34);
    expect(result.current.longitude).toBe(56.78);
  });

  it("reports denied when geolocation fails", async () => {
    navigator.geolocation = {
      getCurrentPosition: (_onSuccess, onError) => onError(new Error("nope")),
    };

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.status).toBe("denied"));
  });
});
