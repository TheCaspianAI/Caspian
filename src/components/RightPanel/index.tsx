import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { FileBrowser } from './FileBrowser';
import { ChangesPanel } from './ChangesPanel';

/**
 * InspectorPane - Always-visible side rail for navigating files and changes
 * Clicking items opens them as tabs in the main view
 */
export function InspectorPane() {
  // Use selector to avoid re-renders from unrelated uiStore changes
  const rightPanelWidth = useUIStore(state => state.rightPanelWidth);
  const [activeSection, setActiveSection] = useState<'files' | 'changes'>('changes');

  return (
    <div
      className="h-full flex flex-col relative"
      style={{ width: rightPanelWidth }}
    >
      {/* Subtle gradient divider on left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

      {/* Inspector header - compact segmented control */}
      <div className="flex-shrink-0 px-2.5 py-2.5">
        {/* Segmented control - 28px height */}
        <div className="h-[28px] flex items-center p-0.5 rounded-lg bg-white/[0.04]">
          <button
            onClick={() => setActiveSection('changes')}
            className={`flex-1 h-full px-3 text-[12px] font-medium rounded-md transition-all ${
              activeSection === 'changes'
                ? 'text-white/[0.88] bg-white/[0.08]'
                : 'text-white/[0.50] hover:text-white/[0.70]'
            }`}
          >
            Changes
          </button>
          <button
            onClick={() => setActiveSection('files')}
            className={`flex-1 h-full px-3 text-[12px] font-medium rounded-md transition-all ${
              activeSection === 'files'
                ? 'text-white/[0.88] bg-white/[0.08]'
                : 'text-white/[0.50] hover:text-white/[0.70]'
            }`}
          >
            Directory
          </button>
        </div>
      </div>
      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-2.5" />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={activeSection === 'files' ? 'h-full' : 'hidden'}>
          <FileBrowser />
        </div>
        <div className={activeSection === 'changes' ? 'h-full' : 'hidden'}>
          <ChangesPanel />
        </div>
      </div>
    </div>
  );
}

// Legacy export for backward compatibility
export { InspectorPane as RightPanel };
