import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./Home";

describe("Home", () => {
  it("renders the application title", () => {
    render(<Home />);

    expect(screen.getByText("Navo")).toBeInTheDocument();
  });
});
