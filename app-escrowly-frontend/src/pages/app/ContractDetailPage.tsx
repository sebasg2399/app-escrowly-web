import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../features/auth/useAuth";
import { useContract } from "../../features/contracts/useContract";
import { deriveViewerRole } from "../../features/contracts/contracts-types";
import ContractDetailView, {
  ContractDetailError,
} from "../../features/contracts/ContractDetailView";
import FullPageLoader from "../../components/organisms/FullPageLoader";
import { isApiError } from "../../lib/api/errors";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: contract, isLoading, error } = useContract(id);

  const handleBack = () => navigate("/app/contracts");

  if (isLoading) {
    return <FullPageLoader message="Loading contract..." />;
  }

  if (error && isApiError(error) && (error.status === 403 || error.status === 404)) {
    return (
      <ContractDetailError
        message="This contract does not exist or you don't have access to it."
        onBack={handleBack}
      />
    );
  }

  if (!contract) {
    return (
      <ContractDetailError
        message="This contract is not available right now."
        onBack={handleBack}
      />
    );
  }

  const viewerRole = deriveViewerRole(profile?.id, contract);

  return <ContractDetailView contract={contract} viewerRole={viewerRole} onBack={handleBack} />;
}
