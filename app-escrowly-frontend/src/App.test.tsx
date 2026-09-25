import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App.tsx";

describe("App", () => {
  it("renders the shell with Escrowly wordmark", () => {
    render(<App />);
    expect(screen.getByText("Escrowly")).toBeInTheDocument();
  });

  it("renders the welcome message", () => {
    render(<App />);
    expect(screen.getByText(/Welcome to Escrowly/i)).toBeInTheDocument();
  });
});
