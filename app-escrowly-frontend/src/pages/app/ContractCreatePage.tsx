import { useNavigate } from "react-router";
import ContractCreateForm from "../../features/contracts/ContractCreateForm";

export default function ContractCreatePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Create contract</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Set the seller and the milestones you want to escrow.
        </p>
      </div>
      <ContractCreateForm onCancel={() => navigate("/app/contracts")} />
    </div>
  );
}
