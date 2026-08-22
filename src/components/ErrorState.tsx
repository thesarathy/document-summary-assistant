interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  onStartOver: () => void;
}

export function ErrorState({ message, onRetry, onStartOver }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="w-full rounded-2xl border border-error-soft bg-error-soft px-8 py-10 text-center"
    >
      <p className="font-display text-lg text-ink">Something went wrong</p>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        )}
        <button
          onClick={onStartOver}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper"
        >
          Upload a different file
        </button>
      </div>
    </div>
  );
}
