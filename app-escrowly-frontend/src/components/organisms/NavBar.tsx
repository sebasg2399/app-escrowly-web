import { useState, useRef, useEffect } from "react";
import Badge from "../atoms/Badge";

export interface NavBarProps {
  role?: "client" | "seller" | "admin";
  userName?: string;
  onNavigateDashboard?: () => void;
  onNavigateContracts?: () => void;
  onNavigateProfile?: () => void;
  onNavigatePayouts?: () => void;
  onLogout?: () => void;
}

export default function NavBar({
  role,
  userName,
  onNavigateDashboard,
  onNavigateContracts,
  onNavigateProfile,
  onNavigatePayouts,
  onLogout,
}: NavBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  return (
    <header className="border-b border-neutral-200 bg-background px-6 py-3">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-primary tracking-tight">Escrowly</span>
          <button
            onClick={onNavigateDashboard}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            data-testid="nav-dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={onNavigateContracts}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            data-testid="nav-contracts"
          >
            Contracts
          </button>
        </div>

        {userName && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <div className="h-8 w-8 rounded-full bg-primary text-primary-fg flex items-center justify-center text-sm font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-foreground hidden sm:inline">{userName}</span>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-lg border border-neutral-200 bg-background shadow-dropdown py-1 z-50"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-neutral-100">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  {role && (
                    <Badge variant={role} className="mt-1 capitalize">
                      {role}
                    </Badge>
                  )}
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigateProfile?.();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-neutral-50"
                >
                  Profile
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigatePayouts?.();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-neutral-50"
                  data-testid="nav-payouts"
                >
                  Payouts
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout?.();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/5"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
