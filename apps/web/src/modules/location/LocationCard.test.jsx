import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocationCard from "./LocationCard";

describe("LocationCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders name and address", () => {
    render(
      <LocationCard location={{ name: "Trader Joe's", address: "1 Main St" }} />
    );

    expect(screen.getByText("Trader Joe's")).toBeInTheDocument();
    expect(screen.getByText("1 Main St")).toBeInTheDocument();
  });

  it("shows rating and reviews count when present", () => {
    render(
      <LocationCard
        location={{ name: "Trader Joe's", rating: 4.5, ratingsCount: 120 }}
      />
    );

    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByText("(120)")).toBeInTheDocument();
  });

  it("shows a tel: link for the phone number", () => {
    render(
      <LocationCard
        location={{ name: "Trader Joe's", phoneNumber: "+1 555-0100" }}
      />
    );

    const link = screen.getByRole("link", { name: /555-0100/ });
    expect(link).toHaveAttribute("href", "tel:+1 555-0100");
  });

  it("shows a live open/closed status derived from opening periods", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 16, 30)); // Monday 4:30 PM

    render(
      <LocationCard
        location={{
          name: "Trader Joe's",
          openingPeriods: [
            {
              open: { day: 1, time: "0900" },
              close: { day: 1, time: "1700" },
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Closes in 30m")).toBeInTheDocument();
  });

  it("renders no rating/phone/status row when none of that data exists", () => {
    render(<LocationCard location={{ name: "Trader Joe's" }} />);

    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
