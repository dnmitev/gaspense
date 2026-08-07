import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

// A smoke test of the whole chain: React 19 + TypeScript + JSX transform +
// jsdom + the "@/" path alias all have to work for this to pass. There is
// little application logic to test yet, so the value here is proving the
// harness is wired correctly — not the assertions themselves.
describe("Home page", () => {
  it("renders the application name as the top-level heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Gaspense" })).toBeInTheDocument();
  });

  it("states that the shell is in place but features are not built yet", () => {
    render(<Home />);

    expect(screen.getByText(/application shell is in place/i)).toBeInTheDocument();
  });
});
