interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  canDismiss?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  canDismiss = true,
}: BottomSheetProps) {
  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (canDismiss) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        className="relative w-full glass-popover border-t border-white/[0.08] rounded-t-2xl transform transition-transform duration-medium ease-standard"
        style={{ animation: 'slideUp 0.3s ease-out', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 -25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-border-primary rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-6 py-3 border-b border-border-primary">
            <h3 className="text-display font-semibold text-text-primary">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
