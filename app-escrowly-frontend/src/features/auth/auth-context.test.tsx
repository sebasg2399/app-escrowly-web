import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { AuthProvider } from "./auth-context";
import { useAuth } from "./useAuth";
import { getAccessToken } from "../../lib/api/client";

function withRouter(ui: React.ReactNode) {
  return (
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider", () => {
  it("starts in loading state", () => {
    function StatusDisplay() {
      const { status } = useAuth();
      return <span data-testid="status">{status}</span>;
    }
    render(withRouter(<StatusDisplay />));
    expect(screen.getByTestId("status").textContent).toBe("loading");
  });

  describe("restore", () => {
    it("transitions to authed on successful refresh + profile fetch", async () => {
      server.use(
        http.post("/auth/refresh", () => HttpResponse.json({ accessToken: "restored-token" })),
        http.get("/users/me", () =>
          HttpResponse.json({
            id: "1",
            email: "a@b.com",
            name: "Restored User",
            role: "client",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        ),
      );

      let restoreFn: (() => Promise<void>) | null = null;
      function RestoreTester() {
        const auth = useAuth();
        restoreFn = auth.restore;
        return (
          <div>
            <span data-testid="status">{auth.status}</span>
            {auth.profile && <span data-testid="profile-name">{auth.profile.name}</span>}
          </div>
        );
      }

      render(withRouter(<RestoreTester />));

      expect(screen.getByTestId("status").textContent).toBe("loading");

      await act(async () => {
        await restoreFn!();
      });

      expect(screen.getByTestId("status").textContent).toBe("authed");
      expect(screen.getByTestId("profile-name").textContent).toBe("Restored User");
      expect(getAccessToken()).toBe("restored-token");
    });

    it("transitions to guest when refresh fails (401)", async () => {
      server.use(
        http.post("/auth/refresh", () =>
          HttpResponse.json({ code: "UNAUTHORIZED", message: "No refresh token" }, { status: 401 }),
        ),
      );

      let restoreFn: (() => Promise<void>) | null = null;
      function RestoreTester() {
        const auth = useAuth();
        restoreFn = auth.restore;
        return <span data-testid="status">{auth.status}</span>;
      }

      render(withRouter(<RestoreTester />));

      expect(screen.getByTestId("status").textContent).toBe("loading");

      await act(async () => {
        await restoreFn!();
      });

      expect(screen.getByTestId("status").textContent).toBe("guest");
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("register", () => {
    it("sets authed status and profile on success", async () => {
      server.use(
        http.post("/auth/register", () =>
          HttpResponse.json({ accessToken: "reg-token" }, { status: 201 }),
        ),
        http.get("/users/me", () =>
          HttpResponse.json({
            id: "1",
            email: "new@example.com",
            name: "New User",
            role: "client",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        ),
      );

      let registerFn:
        ((data: { name: string; email: string; password: string }) => Promise<void>) | null = null;
      function RegisterTester() {
        const auth = useAuth();
        registerFn = auth.register;
        return <span data-testid="status">{auth.status}</span>;
      }

      render(withRouter(<RegisterTester />));

      await act(async () => {
        await registerFn!({
          name: "New User",
          email: "new@example.com",
          password: "SecurePass1",
        });
      });

      expect(screen.getByTestId("status").textContent).toBe("authed");
      expect(getAccessToken()).toBe("reg-token");
    });
  });

  describe("login", () => {
    it("sets authed status and profile on success", async () => {
      server.use(
        http.post("/auth/login", () => HttpResponse.json({ accessToken: "login-token" })),
        http.get("/users/me", () =>
          HttpResponse.json({
            id: "1",
            email: "user@example.com",
            name: "Logged In",
            role: "client",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        ),
      );

      let loginFn: ((data: { email: string; password: string }) => Promise<void>) | null = null;
      function LoginTester() {
        const auth = useAuth();
        loginFn = auth.login;
        return <span data-testid="status">{auth.status}</span>;
      }

      render(withRouter(<LoginTester />));

      await act(async () => {
        await loginFn!({ email: "user@example.com", password: "Pass1234" });
      });

      expect(screen.getByTestId("status").textContent).toBe("authed");
      expect(getAccessToken()).toBe("login-token");
    });
  });

  describe("logout", () => {
    it("clears session and sets guest status", async () => {
      server.use(http.post("/auth/logout", () => new HttpResponse(null, { status: 204 })));

      let logoutFn: (() => Promise<void>) | null = null;
      function LogoutTester() {
        const auth = useAuth();
        logoutFn = auth.logout;
        return <span data-testid="status">{auth.status}</span>;
      }

      render(withRouter(<LogoutTester />));

      await act(async () => {
        await logoutFn!();
      });

      expect(screen.getByTestId("status").textContent).toBe("guest");
      expect(getAccessToken()).toBeNull();
    });
  });
});
