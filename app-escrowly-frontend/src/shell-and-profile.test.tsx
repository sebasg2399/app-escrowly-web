import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useRef, useEffect } from "react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "./test/mocks/server";
import { AuthProvider } from "./features/auth/auth-context";
import { useAuth } from "./features/auth/useAuth";
import AuthGuard from "./routes/AuthGuard";
import RootRedirect from "./routes/RootRedirect";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/app/ProfilePage";
import AppLayout from "./pages/app/AppLayout";
import { queryClient } from "./lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";

const VALID_TOKEN = "test-access-token";

function LocationTracker() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

/** Triggers restore() so auth resolves instead of staying "loading" */
function BootRestore() {
  const { status, restore } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    if (status === "loading" && !calledRef.current) {
      calledRef.current = true;
      restore();
    }
  }, [status, restore]);

  return null;
}

function renderWithProviders(initialEntries: string[], ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <BootRestore />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            <Route path="/app" element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route index element={<div data-testid="home-page">Home</div>} />
                <Route path="profile" element={ui} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <LocationTracker />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  server.resetHandlers();
});

describe("AuthGuard — redirect to login", () => {
  it("redirects guest visiting /app/profile to /login", async () => {
    server.use(
      http.post("/auth/refresh", () =>
        HttpResponse.json({ code: "UNAUTHORIZED", message: "No token" }, { status: 401 }),
      ),
    );

    renderWithProviders(["/app/profile"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
    });
  });
});

describe("RootRedirect", () => {
  it("redirects authed user from / to /app", async () => {
    server.use(
      http.post("/auth/refresh", () => HttpResponse.json({ accessToken: VALID_TOKEN })),
      http.get("/users/me", () =>
        HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: "Test User",
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
    );

    renderWithProviders(["/"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/app");
    });
  });

  it("redirects guest from / to /login", async () => {
    server.use(
      http.post("/auth/refresh", () =>
        HttpResponse.json({ code: "UNAUTHORIZED", message: "No token" }, { status: 401 }),
      ),
    );

    renderWithProviders(["/"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
    });
  });
});

describe("Boot loader", () => {
  it("shows loader while status is loading", () => {
    // Don't override handlers — restore is async, so initially loading
    renderWithProviders(["/"], <ProfilePage />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});

describe("NotFound", () => {
  it("renders 404 for unknown path", () => {
    server.use(
      http.post("/auth/refresh", () =>
        HttpResponse.json({ code: "UNAUTHORIZED", message: "No token" }, { status: 401 }),
      ),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/nonexistent/path"]}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <LocationTracker />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
    expect(screen.getByText(/Go back home/i)).toBeInTheDocument();
  });
});

describe("Profile view", () => {
  it("shows name, email, role, member-since and omits password", async () => {
    server.use(
      http.post("/auth/refresh", () => HttpResponse.json({ accessToken: VALID_TOKEN })),
      http.get("/users/me", () =>
        HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: "Test User",
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
    );

    renderWithProviders(["/app/profile"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
      expect(screen.getByTestId("profile-email")).toHaveTextContent("user@example.com");
      expect(screen.getByTestId("profile-role")).toHaveTextContent("client");
      expect(screen.getByTestId("profile-member-since")).toBeInTheDocument();
    });

    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/password/i)).not.toBeInTheDocument();
  });
});

describe("Profile edit", () => {
  it("edits name only, email and role are disabled", async () => {
    server.use(
      http.post("/auth/refresh", () => HttpResponse.json({ accessToken: VALID_TOKEN })),
      http.get("/users/me", () =>
        HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: "Test User",
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
      http.patch("/users/me", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: body.name,
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        });
      }),
    );

    renderWithProviders(["/app/profile"], <ProfilePage />);

    // Wait for view
    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
    });

    // Enter edit mode
    fireEvent.click(screen.getByTestId("edit-profile-button"));

    // Email and role are read-only
    expect(screen.getByTestId("profile-email-disabled")).toBeDisabled();

    // Change name and submit
    const nameInput = screen.getByTestId("profile-name-input");
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });

  it("shows inline error for empty name", async () => {
    server.use(
      http.post("/auth/refresh", () => HttpResponse.json({ accessToken: VALID_TOKEN })),
      http.get("/users/me", () =>
        HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: "Test User",
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
    );

    renderWithProviders(["/app/profile"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
    });

    fireEvent.click(screen.getByTestId("edit-profile-button"));

    // Clear name and submit
    const nameInput = screen.getByTestId("profile-name-input");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
  });

  it("shows inline error for 400 API response", async () => {
    server.use(
      http.post("/auth/refresh", () => HttpResponse.json({ accessToken: VALID_TOKEN })),
      http.get("/users/me", () =>
        HttpResponse.json({
          id: "1",
          email: "user@example.com",
          name: "Test User",
          role: "client",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
      http.patch("/users/me", () =>
        HttpResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: { name: ["Name must be unique"] },
          },
          { status: 400 },
        ),
      ),
    );

    renderWithProviders(["/app/profile"], <ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
    });

    fireEvent.click(screen.getByTestId("edit-profile-button"));

    const nameInput = screen.getByTestId("profile-name-input");
    fireEvent.change(nameInput, { target: { value: "Duplicate Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be unique")).toBeInTheDocument();
    });
  });
});
