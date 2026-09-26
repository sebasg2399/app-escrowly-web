import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  createContractInputSchema,
  type CreateContractInput,
  type CreateContractPayload,
} from "./contracts.schemas";
import { useCreateContract } from "./useContract";
import { formatCents, sumCents } from "../../lib/money";
import { isApiError } from "../../lib/api/errors";
import TextField from "../../components/molecules/TextField";
import Button from "../../components/atoms/Button";
import Banner from "../../components/molecules/Banner";
import { dollarsToCents } from "../../lib/money";

interface ContractCreateFormProps {
  onCancel: () => void;
}

export default function ContractCreateForm({ onCancel }: ContractCreateFormProps) {
  const navigate = useNavigate();
  const createContract = useCreateContract();
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateContractInput, unknown, CreateContractPayload>({
    resolver: zodResolver(createContractInputSchema),
    defaultValues: {
      sellerEmail: "",
      milestones: [{ title: "", amount: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "milestones",
  });

  const watched = watch("milestones");

  // Live total preview — runs dollarsToCents on each row, ignores rows that
  // are empty/invalid so the total reflects only what will actually be sent.
  const liveTotalCents = sumCents(
    (Array.isArray(watched) ? watched : []).map((row) => {
      const raw = row?.amount;
      if (typeof raw !== "string" || raw.trim() === "") return 0;
      const cents = dollarsToCents(raw);
      return Number.isFinite(cents) && cents > 0 ? cents : 0;
    }),
  );

  const onSubmit = async (data: CreateContractPayload) => {
    setNonFieldError(null);
    try {
      // Schema has already converted each milestone amount to integer cents.
      const payload = {
        sellerEmail: data.sellerEmail,
        milestones: data.milestones.map((m) => ({ title: m.title, amount: m.amount })),
      };
      const created = await createContract.mutateAsync(payload);
      navigate(`/app/contracts/${created.id}`);
    } catch (err) {
      if (isApiError(err)) {
        // 404 on POST /contracts means the seller account was not found.
        if (err.status === 404) {
          setError("sellerEmail", {
            type: "server",
            message: "No Escrowly account found for this email.",
          });
          return;
        }
        if (err.status === 400 && err.details) {
          for (const [field, messages] of Object.entries(err.details)) {
            setError(field as keyof CreateContractPayload, {
              type: "server",
              message: messages[0],
            });
          }
          return;
        }
        setNonFieldError(err.message);
      } else {
        setNonFieldError("Could not create the contract. Please try again.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-neutral-200 bg-surface p-6 space-y-6"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">New contract</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-neutral-500 hover:text-foreground transition-colors"
          data-testid="cancel-create-contract"
        >
          Cancel
        </button>
      </div>

      {nonFieldError && (
        <Banner variant="error" data-testid="create-contract-api-error">
          {nonFieldError}
        </Banner>
      )}

      <TextField
        label="Seller email"
        type="email"
        placeholder="seller@example.com"
        helper="The seller must already have an Escrowly account."
        error={errors.sellerEmail?.message}
        disabled={isSubmitting}
        required
        data-testid="seller-email-input"
        {...register("sellerEmail")}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">Milestones</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ title: "", amount: "" })}
            disabled={isSubmitting}
            data-testid="add-milestone"
          >
            <Plus className="h-4 w-4" />
            Add milestone
          </Button>
        </div>

        {errors.milestones?.root?.message && (
          <p className="text-sm text-error" role="alert">
            {errors.milestones.root.message}
          </p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-lg border border-neutral-200 p-4 space-y-3"
              data-testid={`milestone-row-${index}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Milestone {index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={isSubmitting}
                    className="text-neutral-400 hover:text-error transition-colors disabled:opacity-50"
                    aria-label={`Remove milestone ${index + 1}`}
                    data-testid={`remove-milestone-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <TextField
                label="Title"
                placeholder="e.g. Initial mockups"
                error={errors.milestones?.[index]?.title?.message}
                disabled={isSubmitting}
                required
                data-testid={`milestone-title-${index}`}
                {...register(`milestones.${index}.title`)}
              />
              <TextField
                label="Amount (USD)"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                error={errors.milestones?.[index]?.amount?.message}
                disabled={isSubmitting}
                required
                icon={<span className="text-neutral-400 text-sm">$</span>}
                data-testid={`milestone-amount-${index}`}
                {...register(`milestones.${index}.amount`)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-3">
        <span className="text-sm text-neutral-600">Total</span>
        <span
          className="text-lg font-semibold text-foreground"
          data-testid="contract-total-preview"
        >
          {formatCents(liveTotalCents)}
        </span>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting || createContract.isPending}
          data-testid="submit-create-contract"
        >
          Create contract
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
