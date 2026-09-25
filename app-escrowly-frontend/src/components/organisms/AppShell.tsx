import NavBar from "./NavBar";
import { NavBarProps } from "./NavBar";

export interface AppShellProps extends NavBarProps {
  children: React.ReactNode;
}

export default function AppShell({ children, ...navProps }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <NavBar {...navProps} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
