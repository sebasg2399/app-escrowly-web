import Spinner from "../atoms/Spinner";

export interface FullPageLoaderProps {
  message?: string;
}

export default function FullPageLoader({ message = "Loading..." }: FullPageLoaderProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <Spinner size="lg" className="text-primary" />
      {message && <p className="mt-4 text-sm text-neutral-500">{message}</p>}
    </div>
  );
}
