import type { ReactNode } from 'react';
import { useToastStore } from '../../stores/toastStore';
import type { Toast, ToastType } from '../../stores/toastStore';
import { useNodeStore } from '../../stores/nodeStore';

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-[rgba(18,20,26,0.70)] backdrop-blur-[18px]',
  error: 'bg-[rgba(18,20,26,0.70)] backdrop-blur-[18px]',
  warning: 'bg-[rgba(18,20,26,0.70)] backdrop-blur-[18px]',
  info: 'bg-[rgba(18,20,26,0.70)] backdrop-blur-[18px]',
  'state-change': 'bg-[rgba(18,20,26,0.70)] backdrop-blur-[18px]',
};

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: (
    <div className="w-2 h-2 rounded-full bg-[rgba(80,200,120,0.85)]" />
  ),
  error: (
    <div className="w-2 h-2 rounded-full bg-[rgba(248,113,113,0.85)]" />
  ),
  warning: (
    <div className="w-2 h-2 rounded-full bg-[rgba(251,191,36,0.85)]" />
  ),
  info: (
    <div className="w-2 h-2 rounded-full bg-[rgba(255,122,237,0.85)]" />
  ),
  'state-change': (
    <div className="w-2 h-2 rounded-full bg-[rgba(80,200,120,0.85)]" />
  ),
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const { setActiveNode } = useNodeStore();

  const handleClick = () => {
    if (toast.nodeId) {
      setActiveNode(toast.nodeId);
      removeToast(toast.id);
    }
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl max-w-xs border border-white/[0.08]
                  shadow-[0_4px_12px_rgba(0,0,0,0.25)]
                  ${toast.nodeId ? 'cursor-pointer hover:bg-white/[0.02]' : ''}
                  transition-all animate-in slide-in-from-right-5 duration-fast ${TOAST_COLORS[toast.type]}`}
      onClick={toast.nodeId ? handleClick : undefined}
    >
      <div className="flex-shrink-0">{TOAST_ICONS[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white/[0.86] truncate">{toast.title}</p>
        <p className="text-[11px] text-white/[0.50] truncate">{toast.message}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeToast(toast.id);
        }}
        className="flex-shrink-0 text-white/[0.40] hover:text-white/[0.60] transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
