import { Outlet, useNavigate } from "react-router";
import { useAuth } from "../../features/auth/useAuth";
import AppShell from "../../components/organisms/AppShell";

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShell
      userName={profile?.name}
      role={profile?.role}
      onNavigateDashboard={() => navigate("/app")}
      onNavigateContracts={() => navigate("/app/contracts")}
      onNavigateProfile={() => navigate("/app/profile")}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  );
}
