import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./features/auth/auth-context";
import HomePage from "./pages/app/HomePage";

function renderHomePage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  it("renders the welcome placeholder", () => {
    renderHomePage();
    expect(screen.getByText(/Welcome.*User/i)).toBeInTheDocument();
  });
});
