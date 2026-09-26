import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { server } from "./mocks/server";

// Provide a dummy Stripe publishable key so `lib/stripe.ts` does not throw on
// import during tests. Tests mock `getStripe` directly when they need to
// control the Stripe flow.
import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
