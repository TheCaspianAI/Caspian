import { COMPANY } from "shared/shared-constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "ui/components/ui/dropdown-menu";
import { FaGithub, FaXTwitter } from "react-icons/fa6";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineCog6Tooth,
  HiOutlineEnvelope,
} from "react-icons/hi2";
import { IoBugOutline } from "react-icons/io5";
import { LuKeyboard, LuSettings2 } from "react-icons/lu";
import { useHotkeyText } from "renderer/stores/hotkeys";
import { useOpenSettings } from "renderer/stores/settings-state";

export function AppMenu() {
  const openSettings = useOpenSettings();
  const settingsHotkey = useHotkeyText("OPEN_SETTINGS");
  const shortcutsHotkey = useHotkeyText("SHOW_HOTKEYS");

  function openExternal(url: string): void {
    window.open(url, "_blank");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="no-drag flex items-center justify-center size-7 rounded border border-border/60 bg-secondary/50 hover:bg-secondary hover:border-border transition-all duration-150 ease-out focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="App menu"
        >
          <LuSettings2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Settings */}
        <DropdownMenuItem
          onSelect={() => openSettings()}
        >
          <HiOutlineCog6Tooth className="h-4 w-4" />
          <span>Settings</span>
          {settingsHotkey !== "Unassigned" && (
            <DropdownMenuShortcut>{settingsHotkey}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Help & Support */}
        <DropdownMenuItem
          onClick={() => openSettings("preferences")}
        >
          <LuKeyboard className="h-4 w-4" />
          Keyboard Shortcuts
          {shortcutsHotkey !== "Unassigned" && (
            <DropdownMenuShortcut>{shortcutsHotkey}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openExternal(COMPANY.REPORT_ISSUE_URL)}
        >
          <IoBugOutline className="h-4 w-4" />
          Report Issue
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HiOutlineChatBubbleLeftRight className="h-4 w-4" />
            Contact Us
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={8} className="w-56">
            <DropdownMenuItem onClick={() => openExternal(COMPANY.GITHUB_URL)}>
              <FaGithub className="h-4 w-4" />
              GitHub
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openExternal(COMPANY.X_URL)}>
              <FaXTwitter className="h-4 w-4" />X
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openExternal(COMPANY.MAIL_TO)}>
              <HiOutlineEnvelope className="h-4 w-4" />
              Email Founders
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
