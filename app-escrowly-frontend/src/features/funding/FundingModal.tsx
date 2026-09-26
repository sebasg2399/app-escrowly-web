import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import Banner from "../../components/molecules/Banner";
import Button from "../../components/atoms/Button";
import { formatCents } from "../../lib/money";
import { getStripe } from "../../lib/stripe";
import { useFundMilestone } from "./useFundMilestone";

interface FundingModalProps {
  contractId: string;
  milestoneId: string;
  amountCents: number;
  onClose: () => void;
  onSucceeded: () => void;
}

/**
 * Funding modal — fetches a Stripe `clientSecret` for the milestone, mounts
 * Stripe.js Payment Element inside `<Elements>`, and confirms the payment.
 *
 * Money shown comes from `amountCents` (integer cents, formatted). The webhook
 * flips the milestone to `funded` after a successful charge; this modal
 * closes on `succeeded` and invalidates the contract query so the UI reflects
 * the new state immediately (and the 5s polling kicks in for the slow case).
 */
export default function FundingModal({
  contractId,
  milestoneId,
  amountCents,
  onClose,
  onSucceeded,
}: FundingModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fund = useFundMilestone();

  useEffect(() => {
    setError(null);
    setClientSecret(null);
    fund.mutate(
      { contractId, milestoneId },
      {
        onSuccess: (data) => setClientSecret(data.clientSecret),
        onError: (err: unknown) =>
          setError(err instanceof Error ? err.message : "Could not start payment."),
      },
    );
    // we intentionally only fire when the modal mounts / changes target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="funding-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      data-testid="funding-modal"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-background p-6 shadow-card space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="funding-modal-title" className="text-lg font-semibold text-foreground">
              Fund milestone
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pay{" "}
              <span className="font-semibold text-foreground" data-testid="funding-amount">
                {formatCents(amountCents)}
              </span>{" "}
              to escrow this milestone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close funding modal"
            className="text-sm text-neutral-500 hover:text-foreground"
            data-testid="funding-modal-close"
          >
            ×
          </button>
        </div>

        {error && (
          <Banner variant="error" data-testid="funding-modal-error">
            {error}
          </Banner>
        )}

        {clientSecret ? (
          <Elements
            stripe={getStripe()}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <FundingForm
              amountCents={amountCents}
              onClose={onClose}
              onSucceeded={onSucceeded}
              onError={setError}
            />
          </Elements>
        ) : (
          <div className="py-10 text-center text-sm text-neutral-500" data-testid="funding-loading">
            Preparing secure payment…
          </div>
        )}

        <p className="text-xs text-neutral-500">
          Funds are held in escrow until you approve the work.
        </p>
      </div>
    </div>
  );
}

interface FundingFormProps {
  amountCents: number;
  onClose: () => void;
  onSucceeded: () => void;
  onError: (msg: string | null) => void;
}

function FundingForm({ amountCents, onClose, onSucceeded, onError }: FundingFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Payment submission failed");
      setSubmitting(false);
      return;
    }
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app/contracts`,
      },
      redirect: "if_required",
    });
    if (error) {
      onError(error.message ?? "Payment was not completed");
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSucceeded();
      return;
    }
    // The PaymentIntent needs further action (e.g. 3DS) — Stripe.js will
    // handle the redirect automatically when `redirect: "if_required"`.
    onError("Payment requires further action. Follow the browser prompt.");
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-sm text-neutral-600">Total</span>
        <span className="text-base font-semibold text-foreground">{formatCents(amountCents)}</span>
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          disabled={!stripe || submitting}
          onClick={handlePay}
          data-testid="funding-modal-pay"
        >
          Pay {formatCents(amountCents)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={submitting}
          data-testid="funding-modal-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
