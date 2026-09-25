import { useNavigate } from "react-router";
import { useAuth } from "../../features/auth/useAuth";
import { useContracts } from "../../features/contracts/useContracts";
import ContractsList, {
  ContractsEmptyState,
  ContractsListSkeleton,
} from "../../features/contracts/ContractsList";
import Button from "../../components/atoms/Button";

export default function ContractsListPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: contracts, isLoading } = useContracts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contracts</h1>
          <p className="mt-1 text-sm text-neutral-600">Your active and past escrow contracts.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate("/app/contracts/new")}
          data-testid="new-contract-button"
        >
          New contract
        </Button>
      </div>

      {isLoading && <ContractsListSkeleton />}

      {!isLoading && contracts && contracts.length === 0 && (
        <ContractsEmptyState onCreate={() => navigate("/app/contracts/new")} />
      )}

      {!isLoading && contracts && contracts.length > 0 && (
        <ContractsList
          contracts={contracts}
          viewerId={profile?.id}
          onSelect={(id) => navigate(`/app/contracts/${id}`)}
        />
      )}
    </div>
  );
}
