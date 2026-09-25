import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./test/mocks/server";
import { appRoutes } from "./routes/routes";
import { queryClient } from "./lib/query-client";

/**
 * Guards the real route tree wiring. A previous bug had AuthProvider (which calls
 * useNavigate during render) OUTSIDE the RouterProvider, crashing the app on boot.
 */
describe("app router wiring", () => {
  it("renders the login route against the real route tree", async () => {
    server.use(
      http.post("/auth/refresh", () =>
        HttpResponse.json({ code: "UNAUTHORIZED", message: "No token" }, { status: 401 }),
      ),
    );

    const router = createMemoryRouter(appRoutes, { initialEntries: ["/login"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
  });
});
