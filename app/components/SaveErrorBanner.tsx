'use client';

interface SaveErrorBannerProps {
  message: string;
  onReload: () => void;
  onDismiss: () => void;
}

export default function SaveErrorBanner({ message, onReload, onDismiss }: SaveErrorBannerProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white text-sm px-4 py-2 rounded-md shadow-lg">
      <span>{message}</span>
      <button onClick={onReload} className="font-medium underline hover:no-underline">
        Reload board
      </button>
      <button onClick={onDismiss} className="text-white/80 hover:text-white" title="Dismiss">
        ✕
      </button>
    </div>
  );
}
