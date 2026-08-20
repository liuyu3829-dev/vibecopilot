import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("./auth-mode", () => ({ shouldRequireAuth: () => true }));

describe("local data migration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
  });

  it("offers a one-time migration from the local database in Settings", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Migrate local data" })).toBeInTheDocument();
  });
});
