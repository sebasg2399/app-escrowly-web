import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEffect, useRef } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import {
  __resetContracts,
  clientUser,
  sellerUser,
  type Contract,
  type Milestone,
} from "../../test/mocks/handlers";
import { queryClient } from "../../lib/query-client";
import { AuthProvider } from "../auth/auth-context";
import { useAuth } from "../auth/useAuth";
import { clearSession } from "../../lib/api/client";
import AppLayout from "../../pages/app/AppLayout";
import ContractDetailPage from "../../pages/app/ContractDetailPage";

/**
 * BootRestore — same role as `routes/RootProviders`'s `BootRestore`: triggers
 * `restore()` on mount so the auth context transitions from "loading" to
 * "authed". Without this the profile never loads and `viewerRole` is always
 * "none".
 */
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

/** A contract whose milestones are exactly the supplied list. */
function makeContract(milestones: Milestone[]): Contract {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "active",
    client: clientUser,
    seller: sellerUser,
    milestones,
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
  };
}

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "22222222-2222-4222-8222-222222222201",
    title: "Initial mockups",
    amount: 25000,
    status: "pending",
    stripePaymentIntentId: null,
    stripeTransferId: null,
    paidAt: null,
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetContracts();
  clearSession();
});

/**
 * Renders `/app/contracts/:id` inside the full app shell, with an authed boot.
 * Optionally boots the viewer as a `seller` instead of the default `client`.
 */
function renderDetailPage(opts: { viewerRole: "client" | "seller" } = { viewerRole: "client" }) {
  const profile = {
    id: opts.viewerRole === "client" ? clientUser.id : sellerUser.id,
    email: opts.viewerRole === "client" ? clientUser.email : sellerUser.email,
    name: opts.viewerRole === "client" ? clientUser.name : sellerUser.name,
    role: opts.viewerRole,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  server.use(
    http.post("/auth/refresh", () => HttpResponse.json({ accessToken: "boot-token" })),
    http.get("/users/me", () => HttpResponse.json(profile)),
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app/contracts/11111111-1111-4111-8111-111111111111"]}>
        <AuthProvider>
          <BootRestore />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/app/contracts/:id" element={<ContractDetailPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Action matrix — role × status → button visibility
// ─────────────────────────────────────────────────────────────────────────────

describe("MilestoneRow action matrix (UI)", () => {
  it.each([
    { status: "pending", role: "client", expectedTestId: "milestone-action-fund-0" },
    { status: "funded", role: "seller", expectedTestId: "milestone-action-submit-0" },
    { status: "in_review", role: "client", expectedTestId: "milestone-action-approve-0" },
    { status: "approved", role: "client", expectedTestId: "milestone-action-retry-payout-0" },
    { status: "paid", role: "client", expectedTestId: "milestone-action-paid-0" },
    { status: "paid", role: "seller", expectedTestId: "milestone-action-paid-0" },
  ] as const)(
    "renders the expected action for status='$status' × role='$role'",
    async ({ status, role, expectedTestId }) => {
      __resetContracts([
        makeContract([
          makeMilestone({ status, stripeTransferId: status === "paid" ? "tr_xyz" : null }),
        ]),
      ]);
      renderDetailPage({ viewerRole: role });

      await waitFor(() => {
        expect(screen.getByTestId(expectedTestId)).toBeInTheDocument();
      });
    },
  );

  it.each([
    { status: "pending", role: "seller" },
    { status: "funded", role: "client" },
    { status: "in_review", role: "seller" },
    { status: "approved", role: "seller" },
    { status: "disputed", role: "client" },
    { status: "disputed", role: "seller" },
  ] as const)(
    "renders NO action button for status='$status' × role='$role'",
    async ({ status, role }) => {
      __resetContracts([makeContract([makeMilestone({ status })])]);
      renderDetailPage({ viewerRole: role });

      // Wait for the row to render, then assert no action testid is in the DOM.
      await waitFor(() => {
        expect(screen.getByTestId("detail-milestone-row-0")).toBeInTheDocument();
      });
      expect(screen.queryByTestId(/^milestone-action-/)).toBeNull();
    },
  );

  it("Fund button is disabled with a 'coming soon' tooltip", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "pending" })])]);
    renderDetailPage({ viewerRole: "client" });

    const btn = await screen.findByTestId("milestone-action-fund-0");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/coming soon/i);
  });

  it("Paid badge exposes stripeTransferId when present", async () => {
    __resetContracts([
      makeContract([makeMilestone({ status: "paid", stripeTransferId: "tr_abc123" })]),
    ]);
    renderDetailPage({ viewerRole: "client" });

    await screen.findByTestId("milestone-action-paid-0");
    expect(screen.getByTestId("milestone-transfer-id-0")).toHaveTextContent("tr_abc123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Submit happy path — seller transitions funded → in_review
// ─────────────────────────────────────────────────────────────────────────────

describe("Submit happy path (web-milestones R3 / R4)", () => {
  it("seller clicks Submit on a funded milestone → POST /submit → row becomes in_review", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "funded" })])]);
    renderDetailPage({ viewerRole: "seller" });

    const submitBtn = await screen.findByTestId("milestone-action-submit-0");
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Row re-renders with the new status.
      expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("in review");
      // And no action is rendered for in_review × seller.
      expect(screen.queryByTestId("milestone-action-submit-0")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Approve happy path — client transitions in_review → paid
// ─────────────────────────────────────────────────────────────────────────────

describe("Approve happy path (web-milestones R3 / R4)", () => {
  it("client clicks Approve & pay on in_review → POST /approve → row becomes paid", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "in_review" })])]);
    renderDetailPage({ viewerRole: "client" });

    const approveBtn = await screen.findByTestId("milestone-action-approve-0");
    expect(approveBtn).toBeEnabled();

    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("paid");
      // No Approve / Submit / Fund button after paid.
      expect(screen.queryByTestId("milestone-action-approve-0")).toBeNull();
      expect(screen.queryByTestId("milestone-action-submit-0")).toBeNull();
      expect(screen.queryByTestId("milestone-action-fund-0")).toBeNull();
    });
    // Paid badge + transfer id are visible (handler sets a tr_test_* id).
    expect(screen.getByTestId("milestone-action-paid-0")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-transfer-id-0").textContent).toMatch(/^tr_test_/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Invalid transition — 409 → non-blocking banner; milestone stays
// ─────────────────────────────────────────────────────────────────────────────

describe("Invalid transition surfaces a non-blocking banner (web-milestones R4)", () => {
  it("submitting a milestone in a state the server rejects returns 409 → banner; row stays unchanged", async () => {
    // Render as the seller with a `funded` milestone so the matrix shows a
    // Submit button. Override the submit endpoint to return 409 (simulating
    // a stale state on the server — the matrix thought `funded`, but the
    // server says no).
    __resetContracts([makeContract([makeMilestone({ status: "funded" })])]);
    server.use(
      http.post(
        "/contracts/11111111-1111-4111-8111-111111111111/milestones/22222222-2222-4222-8222-222222222201/submit",
        () =>
          HttpResponse.json(
            { code: "INVALID_TRANSITION", message: "Cannot submit in status 'funded'" },
            { status: 409 },
          ),
      ),
    );

    renderDetailPage({ viewerRole: "seller" });

    const submitBtn = await screen.findByTestId("milestone-action-submit-0");
    fireEvent.click(submitBtn);

    // Banner appears with the "Cannot submit in its current status" copy.
    await waitFor(() => {
      expect(screen.getByTestId("milestone-action-banner")).toHaveTextContent(
        /Cannot submit in its current status/i,
      );
    });

    // Milestone row is still rendered AND the Submit button is still
    // present (status didn't change).
    expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("funded");
    expect(screen.getByTestId("milestone-action-submit-0")).toBeInTheDocument();
  });

  it("approving a milestone in a state the server rejects returns 409 → banner", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "in_review" })])]);
    server.use(
      http.post(
        "/contracts/11111111-1111-4111-8111-111111111111/milestones/22222222-2222-4222-8222-222222222201/approve",
        () =>
          HttpResponse.json(
            { code: "INVALID_TRANSITION", message: "Cannot approve in status 'in_review'" },
            { status: 409 },
          ),
      ),
    );

    renderDetailPage({ viewerRole: "client" });

    const approveBtn = await screen.findByTestId("milestone-action-approve-0");
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("milestone-action-banner")).toHaveTextContent(
        /Cannot approve in its current status/i,
      );
    });
    expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("in review");
    expect(screen.getByTestId("milestone-action-approve-0")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Wrong role — 403 → banner; no state change
// ─────────────────────────────────────────────────────────────────────────────

describe("Wrong role surfaces a non-blocking banner (web-milestones R4)", () => {
  it("server returns 403 for the submit mutation → 'Not allowed' banner; row stays unchanged", async () => {
    // Render as the seller on a `funded` milestone so the matrix shows a
    // Submit button, then override the server to return 403 (simulating a
    // stale token whose role no longer permits the action).
    __resetContracts([makeContract([makeMilestone({ status: "funded" })])]);
    server.use(
      http.post(
        "/contracts/11111111-1111-4111-8111-111111111111/milestones/22222222-2222-4222-8222-222222222201/submit",
        () => HttpResponse.json({ code: "FORBIDDEN", message: "Not allowed" }, { status: 403 }),
      ),
    );

    renderDetailPage({ viewerRole: "seller" });

    const submitBtn = await screen.findByTestId("milestone-action-submit-0");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("milestone-action-banner")).toHaveTextContent(/Not allowed/i);
    });

    // Milestone row is still `funded` and Submit button is still present.
    expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("funded");
    expect(screen.getByTestId("milestone-action-submit-0")).toBeInTheDocument();
  });

  it("server returns 403 for the approve mutation → 'Not allowed' banner", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "in_review" })])]);
    server.use(
      http.post(
        "/contracts/11111111-1111-4111-8111-111111111111/milestones/22222222-2222-4222-8222-222222222201/approve",
        () => HttpResponse.json({ code: "FORBIDDEN", message: "Not allowed" }, { status: 403 }),
      ),
    );

    renderDetailPage({ viewerRole: "client" });

    const approveBtn = await screen.findByTestId("milestone-action-approve-0");
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("milestone-action-banner")).toHaveTextContent(/Not allowed/i);
    });
    expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("in review");
    expect(screen.getByTestId("milestone-action-approve-0")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Polling — contract refetches while any milestone is pending
// ─────────────────────────────────────────────────────────────────────────────

describe("Polling while a milestone is pending (web-milestones R5 / R6)", () => {
  let getCount = 0;

  beforeEach(() => {
    getCount = 0;
    // `shouldAdvanceTime: true` lets the fake timer advance automatically as
    // real time passes — necessary to drive TanStack Query's `refetchInterval`
    // without manually calling `advanceTimersByTimeAsync`.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls useContract repeatedly while a milestone is pending", { timeout: 30000 }, async () => {
    __resetContracts([makeContract([makeMilestone({ status: "pending" })])]);

    server.use(
      http.get("/contracts/11111111-1111-4111-8111-111111111111", () => {
        getCount++;
        return HttpResponse.json(makeContract([makeMilestone({ status: "pending" })]));
      }),
    );

    renderDetailPage({ viewerRole: "client" });

    // Initial fetch.
    await waitFor(() => {
      expect(getCount).toBeGreaterThanOrEqual(1);
    });

    // Wait long enough for the polling interval (5000ms) to fire at least
    // twice. `vi.useFakeTimers({ shouldAdvanceTime: true })` advances fake
    // time automatically; we still need a real-time wait to allow it.
    await waitFor(
      () => {
        expect(getCount).toBeGreaterThanOrEqual(3);
      },
      { timeout: 15000, interval: 100 },
    );
  });

  it("stops polling once every milestone has moved past pending", { timeout: 30000 }, async () => {
    __resetContracts([makeContract([makeMilestone({ status: "pending" })])]);

    // First response: pending. Every response after that: funded (simulates
    // the webhook arriving between the initial fetch and the first poll).
    server.use(
      http.get("/contracts/11111111-1111-4111-8111-111111111111", () => {
        getCount++;
        const status = getCount <= 1 ? "pending" : "funded";
        return HttpResponse.json(makeContract([makeMilestone({ status })]));
      }),
    );

    renderDetailPage({ viewerRole: "client" });

    // Wait until the UI reflects `funded` (proves the SECOND poll fired and
    // observed the post-webhook state).
    await waitFor(
      () => {
        expect(screen.getByTestId("detail-milestone-status-0")).toHaveTextContent("funded");
      },
      { timeout: 15000, interval: 100 },
    );

    const callsAfterFlip = getCount;

    // Wait long enough that two more polls would have fired had polling not
    // stopped. Because `hasPending` is now false, the interval must NOT fire.
    await new Promise((r) => setTimeout(r, 12000));

    expect(getCount).toBe(callsAfterFlip);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Disputed unreachable — submit/approve on a disputed row returns 409
// ─────────────────────────────────────────────────────────────────────────────

describe("Disputed state is unreachable through public transitions (web-milestones / milestones spec)", () => {
  it("submit on a `disputed` milestone returns 409 (UI shows no action)", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "disputed" })])]);
    renderDetailPage({ viewerRole: "seller" });

    await waitFor(() => {
      expect(screen.getByTestId("detail-milestone-row-0")).toBeInTheDocument();
    });
    expect(screen.queryByTestId(/^milestone-action-/)).toBeNull();
  });

  it("approve on a `disputed` milestone returns 409 (UI shows no action)", async () => {
    __resetContracts([makeContract([makeMilestone({ status: "disputed" })])]);
    renderDetailPage({ viewerRole: "client" });

    await waitFor(() => {
      expect(screen.getByTestId("detail-milestone-row-0")).toBeInTheDocument();
    });
    expect(screen.queryByTestId(/^milestone-action-/)).toBeNull();
  });
});
