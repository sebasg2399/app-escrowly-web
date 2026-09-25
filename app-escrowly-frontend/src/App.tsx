import AppShell from "./components/organisms/AppShell";
import Button from "./components/atoms/Button";

export default function App() {
  return (
    <AppShell userName="Demo User" role="client">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Welcome to Escrowly</h1>
        <p className="text-neutral-600">Contracts and milestones are coming next.</p>
        <div className="flex gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
