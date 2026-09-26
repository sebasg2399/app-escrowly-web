import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazy Stripe.js loader using the publishable key. Memoized so we only
 * `loadStripe` once. Throws a clear error if the publishable key env is not
 * configured (tests should set it in `src/test/setup.ts` or mock this module).
 */
export function getStripe(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise;
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("VITE_STRIPE_PUBLISHABLE_KEY is not set");
  }
  stripePromise = loadStripe(key);
  return stripePromise;
}
