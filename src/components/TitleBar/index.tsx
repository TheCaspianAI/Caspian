/**
 * TitleBar - macOS-style window title bar region
 * Provides drag region for window movement and space for traffic light buttons
 */
export function TitleBar() {
  return (
    <div
      className="title-bar flex items-center justify-center"
      data-tauri-drag-region
    >
      <span className="text-xs text-text-muted font-medium tracking-wide select-none">
        Caspian
      </span>
    </div>
  );
}
