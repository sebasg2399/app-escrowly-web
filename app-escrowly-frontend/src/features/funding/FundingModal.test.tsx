import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the Stripe React Elements surface so we never touch the real SDK.
// The mock factories read a mutable test flag so individual tests can flip
// `confirmPayment` between "succeeded" and "declined" without re-mocking the
// module mid-test.
vi.mock("@stripe/react-stripe-js", () => {
  type MockState = {
    confirmPaymentResult: { error?: { message: string } } & { paymentIntent?: unknown };
  };
  const state: MockState = {
    confirmPaymentResult: { paymentIntent: { id: "pi_test_1", status: "succeeded" } },
  };
  // Exposed for tests via vi.hoisted/globalThis — the module mock closes
  // over `state` so the same object is read by the component and the tests.
  (globalThis as { __stripeMock?: MockState }).__stripeMock = state;
  return {
    Elements: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="elements-stub">{children}</div>
    ),
    PaymentElement: () => <div data-testid="payment-element-stub" />,
    useStripe: () => ({
      confirmPayment: vi.fn(async () => state.confirmPaymentResult),
    }),
    useElements: () => ({
      submit: vi.fn(async () => ({ error: null })),
    }),
  };
});

// Mock our Stripe loader to return a fake Stripe instance.
vi.mock("../../lib/stripe", () => ({
  getStripe: () => Promise.resolve({} as never),
}));

// Avoid full-page navigation when launchOnboarding fires.
const originalLocation = window.location;
Object.defineProperty(window, "location", {
  configurable: true,
  value: { ...originalLocation, assign: vi.fn() },
});

import FundingModal from "./FundingModal";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw";

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setConfirmPaymentResult(result: {
  error?: { message: string };
  paymentIntent?: { status: string };
}) {
  const state = (globalThis as { __stripeMock?: { confirmPaymentResult: unknown } }).__stripeMock;
  if (state) state.confirmPaymentResult = result;
}

describe("FundingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConfirmPaymentResult({
      paymentIntent: { status: "succeeded" },
    });
  });

  it("renders the milestone amount via formatCents and closes on success", async () => {
    renderWithQuery(
      <FundingModal
        contractId="c1"
        milestoneId="m1"
        amountCents={50000}
        onClose={() => {}}
        onSucceeded={() => {}}
      />,
    );

    expect(screen.getByText(/Preparing secure payment/i)).toBeInTheDocument();

    await waitFor(() => screen.getByTestId("funding-modal-pay"));
    expect(screen.getByTestId("funding-modal-pay")).toHaveTextContent("$500.00");
  });

  it("surfaces a decline error inside the modal and keeps it open", async () => {
    setConfirmPaymentResult({
      error: { message: "Your card was declined." },
    });

    renderWithQuery(
      <FundingModal
        contractId="c1"
        milestoneId="m1"
        amountCents={10000}
        onClose={() => {}}
        onSucceeded={() => {}}
      />,
    );

    await waitFor(() => screen.getByTestId("funding-modal-pay"));
    fireEvent.click(screen.getByTestId("funding-modal-pay"));

    expect(await screen.findByTestId("funding-modal-error")).toHaveTextContent(/declined/i);
  });

  it("shows the 409 banner error when the fund POST is rejected", async () => {
    server.use(
      http.post("/contracts/c1/milestones/m1/fund", () =>
        HttpResponse.json(
          {
            code: "INVALID_TRANSITION",
            message: "Cannot fund a milestone in status 'funded'",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithQuery(
      <FundingModal
        contractId="c1"
        milestoneId="m1"
        amountCents={10000}
        onClose={() => {}}
        onSucceeded={() => {}}
      />,
    );

    expect(await screen.findByTestId("funding-modal-error")).toBeInTheDocument();
  });
});
