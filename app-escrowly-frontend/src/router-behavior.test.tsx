import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./test/mocks/server";
import { appRoutes } from "./routes/routes";
import { queryClient } from "./lib/query-client";

beforeEach(() => {
  queryClient.clear();
  server.resetHandlers();
});

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(appRoutes, { initialEntries });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

function renderAppStrict(initialEntries: string[]) {
  const router = createMemoryRouter(appRoutes, { initialEntries });
  const view = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { router, ...view };
}

const baseProfile = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  name: "Test User",
  role: "client" as const,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

/** Boot the app already-authed: refresh + profile both 200. */
function setupAuthedBoot() {
  server.use(
    http.post("/auth/refresh", () => HttpResponse.json({ accessToken: "boot-token" })),
    http.get("/users/me", () => HttpResponse.json(baseProfile)),
  );
}

/** Boot the app as guest: refresh 401, no /users/me needed. */
function setupGuestBoot() {
  server.use(
    http.post("/auth/refresh", () =>
      HttpResponse.json({ code: "UNAUTHORIZED", message: "No token" }, { status: 401 }),
    ),
  );
}

async function waitForPath(router: ReturnType<typeof createMemoryRouter>, path: string) {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(path);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Guard redirect-back (web-app-shell R2)
// ─────────────────────────────────────────────────────────────────────────────

describe("AuthGuard redirect-back (web-app-shell R2)", () => {
  it("redirects a guest from /app/profile to /login, then returns to /app/profile after login", async () => {
    setupGuestBoot();

    const { router } = renderApp(["/app/profile"]);

    await waitForPath(router, "/login");

    // Switch to a successful login + profile.
    server.use(
      http.post("/auth/login", () => HttpResponse.json({ accessToken: "login-token" })),
      http.get("/users/me", () => HttpResponse.json(baseProfile)),
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitForPath(router, "/app/profile");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Boot does not render protected content (web-app-shell R3)
// ─────────────────────────────────────────────────────────────────────────────

describe("Boot loader (web-app-shell R3)", () => {
  it("shows the loader while status is loading and does not flash protected content", async () => {
    // Slow refresh so we can observe the loading state.
    server.use(
      http.post("/auth/refresh", async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({ accessToken: "boot-token" });
      }),
      http.get("/users/me", () => HttpResponse.json(baseProfile)),
    );

    renderApp(["/app/profile"]);

    // While loading: loader text is in the DOM, profile content is NOT.
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId("profile-name")).toBeNull();
    expect(screen.queryByText("Test User")).toBeNull();

    // After restore resolves, profile content becomes visible.
    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Session-expired redirect + UI (web-app-shell R5, web-auth R7)
// ─────────────────────────────────────────────────────────────────────────────

describe("Session-expired redirect (web-app-shell R5, web-auth R7)", () => {
  it("redirects to /login AND renders 'Your session expired. Please sign in again.'", async () => {
    setupAuthedBoot();

    const { router } = renderApp(["/app/profile"]);

    // Wait until the user is authed and on /app/profile.
    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toBeInTheDocument();
    });

    // Now simulate an expired session: any /users/me 401 + /auth/refresh 401.
    server.use(
      http.get("/users/me", () =>
        HttpResponse.json({ code: "UNAUTHORIZED", message: "Token expired" }, { status: 401 }),
      ),
      http.post("/auth/refresh", () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "Refresh token invalid" },
          { status: 401 },
        ),
      ),
    );

    // Force the profile query to refetch so the failing /users/me fires.
    queryClient.invalidateQueries({ queryKey: ["profile"] });

    await waitForPath(router, "/login");
    await waitFor(() => {
      const banner = screen.getByTestId("session-expired-message");
      expect(banner).toHaveTextContent("Your session expired. Please sign in again.");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Login/Register/Logout navigation (web-auth R1/R4/R5)
// ─────────────────────────────────────────────────────────────────────────────

describe("Login navigation (web-auth R1/R4/R5)", () => {
  it("successful login navigates to /app", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/login", () => HttpResponse.json({ accessToken: "login-token" })),
      http.get("/users/me", () => HttpResponse.json(baseProfile)),
    );

    const { router } = renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitForPath(router, "/app");
  });

  it("successful register navigates to /app", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/register", () =>
        HttpResponse.json({ accessToken: "reg-token" }, { status: 201 }),
      ),
      http.get("/users/me", () => HttpResponse.json(baseProfile)),
    );

    const { router } = renderApp(["/register"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 8/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitForPath(router, "/app");
  });

  it("logout navigates to /login", async () => {
    setupAuthedBoot();
    server.use(http.post("/auth/logout", () => new HttpResponse(null, { status: 204 })));

    const { router } = renderApp(["/app"]);

    await waitFor(() => {
      expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    });

    // Open the user dropdown, then click Log out.
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));

    await waitForPath(router, "/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Register validation (web-auth R2)
// ─────────────────────────────────────────────────────────────────────────────

describe("Register validation (web-auth R2)", () => {
  it("renders inline field errors from the API `details` envelope AND keeps form values", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/register", () =>
        HttpResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: {
              name: ["Name is taken"],
              email: ["Email is blocked"],
            },
          },
          { status: 400 },
        ),
      ),
    );

    renderApp(["/register"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 8/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Name is taken")).toBeInTheDocument();
      expect(screen.getByText("Email is blocked")).toBeInTheDocument();
    });

    // Form values preserved.
    expect((screen.getByPlaceholderText(/your name/i) as HTMLInputElement).value).toBe("Alice");
    expect((screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement).value).toBe(
      "alice@example.com",
    );
    expect((screen.getByPlaceholderText(/at least 8/i) as HTMLInputElement).value).toBe(
      "Passw0rd1",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Duplicate email (web-auth R3)
// ─────────────────────────────────────────────────────────────────────────────

describe("Duplicate email (web-auth R3)", () => {
  it("renders the duplicate-email error on the EMAIL field only", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/register", () =>
        HttpResponse.json({ code: "CONFLICT", message: "Email already exists" }, { status: 409 }),
      ),
    );

    renderApp(["/register"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "exists@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 8/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("An account with this email already exists")).toBeInTheDocument();
    });

    // No top-level non-field banner for the 409 case.
    expect(screen.queryByTestId("non-field-error")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Wrong credentials (web-auth R4)
// ─────────────────────────────────────────────────────────────────────────────

describe("Wrong credentials (web-auth R4)", () => {
  it("login 401 shows a single non-field error that is NOT the session-expired message", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/login", () =>
        HttpResponse.json(
          { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
          { status: 401 },
        ),
      ),
    );

    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: "WrongPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const banner = screen.getByTestId("non-field-error");
      expect(banner).toHaveTextContent("Invalid email or password");
      // MUST NOT reveal which field was wrong AND MUST NOT be the session-expired banner.
      expect(banner.textContent ?? "").not.toMatch(/session expired/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Rate limited (web-auth R8)
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate limited (web-auth R8)", () => {
  it("login 429 shows the rate-limit banner and hides/disables the submit control", async () => {
    setupGuestBoot();
    server.use(
      http.post("/auth/login", () =>
        HttpResponse.json({ code: "RATE_LIMITED", message: "Too many attempts" }, { status: 429 }),
      ),
    );

    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: "Passw0rd1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Banner shows the exact required text.
    await waitFor(() => {
      expect(
        screen.getByText("Too many attempts. Please wait a moment and try again."),
      ).toBeInTheDocument();
    });

    // Submit control is replaced/hidden by the banner — no "Sign in" button anymore.
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Profile R2/R4 — role non-editable + persisted name after PATCH
// ─────────────────────────────────────────────────────────────────────────────

describe("Profile R2/R4", () => {
  it("role is not editable via the edit form (no role input, role rendered as read-only span)", async () => {
    setupAuthedBoot();
    server.use(
      http.patch("/users/me", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({
          ...baseProfile,
          name: body.name,
          updatedAt: new Date().toISOString(),
        });
      }),
    );

    renderApp(["/app/profile"]);

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("edit-profile-button"));

    // Email is a disabled input.
    expect(screen.getByTestId("profile-email-disabled")).toBeDisabled();

    // Role: no input/textarea associated with the "Role" label.
    expect(screen.queryByLabelText(/^role$/i)).toBeNull();

    // And the role text is rendered as a plain span (not inside a form control).
    const editForm = document.querySelector("form") as HTMLFormElement;
    const inputs = Array.from(editForm.querySelectorAll("input,textarea,select"));
    const roleNamedInputs = inputs.filter((el) => /role/i.test(el.getAttribute("name") ?? ""));
    expect(roleNamedInputs).toEqual([]);
  });

  it("after a successful PATCH the view reflects the persisted name (refetched, not just the toast)", async () => {
    let patchCount = 0;
    // Stateful store so the initial load returns "Test User" and the post-PATCH
    // refetch returns "Persisted Name".
    let currentName = "Test User";
    setupAuthedBoot();
    server.use(
      http.patch("/users/me", async ({ request }) => {
        patchCount++;
        const body = (await request.json()) as { name: string };
        currentName = body.name;
        return HttpResponse.json({
          ...baseProfile,
          name: currentName,
          updatedAt: new Date().toISOString(),
        });
      }),
      http.get("/users/me", () => HttpResponse.json({ ...baseProfile, name: currentName })),
    );

    renderApp(["/app/profile"]);

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
    });

    fireEvent.click(screen.getByTestId("edit-profile-button"));

    const nameInput = screen.getByTestId("profile-name-input");
    fireEvent.change(nameInput, { target: { value: "Persisted Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // PATCH fired.
    await waitFor(() => {
      expect(patchCount).toBe(1);
    });

    // Confirmation toast appeared.
    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });

    // Close the toast → ProfileCard re-renders with the refetched profile.
    fireEvent.click(screen.getByRole("button", { name: /close notification/i }));

    await waitFor(() => {
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Persisted Name");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Regression: single boot refresh under StrictMode
// ─────────────────────────────────────────────────────────────────────────────

describe("StrictMode single boot refresh (regression)", () => {
  it("fires exactly one POST /auth/refresh on boot in StrictMode", async () => {
    let refreshCount = 0;
    server.use(
      http.post("/auth/refresh", () => {
        refreshCount++;
        return HttpResponse.json({ accessToken: "boot-token" });
      }),
      http.get("/users/me", () => HttpResponse.json(baseProfile)),
    );

    renderAppStrict(["/"]);

    // Wait until the boot restore has resolved (at least one refresh happened).
    await waitFor(() => {
      expect(refreshCount).toBeGreaterThanOrEqual(1);
    });

    // Give any queued/eager retries a chance to flush.
    await new Promise((r) => setTimeout(r, 50));

    expect(refreshCount).toBe(1);
  });
});
