# Remove Auth and Billing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all authentication, billing/payments, and related features (user avatars, organizations, members) from the Caspian desktop app.

**Architecture:** The app will become a single-user desktop application without authentication. Routes that previously required auth will be directly accessible. Settings will be simplified to app-level preferences only. The OrganizationDropdown will be replaced with a simpler AppMenu for settings and help links.

**Tech Stack:** React, TanStack Router, Electron, tRPC, TypeScript

---

## Phase 1: Remove Billing Features

### Task 1: Delete billing routes and components

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/billing/` (entire directory)
- Delete: `src/renderer/components/Paywall/` (entire directory)

**Step 1: Remove billing directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/billing
```

**Step 2: Remove Paywall directory**

```bash
rm -rf src/renderer/components/Paywall
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove billing routes and paywall components"
```

---

### Task 2: Remove billing from settings sidebar

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx`

**Step 1: Edit GeneralSettings.tsx to remove billing section**

Remove the billing entry from `GENERAL_SECTIONS` array:

```typescript
// REMOVE this object from GENERAL_SECTIONS array:
{
  id: "/settings/billing",
  section: "billing",
  label: "Billing",
  icon: <HiOutlineCreditCard className="h-4 w-4" />,
},
```

Also remove the unused import `HiOutlineCreditCard`.

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx
git commit -m "chore: remove billing from settings sidebar"
```

---

### Task 3: Remove Paywall from authenticated layout

**Files:**
- Modify: `src/renderer/routes/_authenticated/layout.tsx`

**Step 1: Edit layout.tsx to remove Paywall**

Remove the Paywall import and component usage:

```typescript
// REMOVE this import:
import { Paywall } from "renderer/components/Paywall";

// REMOVE <Paywall /> from the JSX return
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/layout.tsx
git commit -m "chore: remove Paywall from authenticated layout"
```

---

### Task 4: Remove billing feature flag and Stripe client

**Files:**
- Modify: `src/shared/shared-constants.ts`
- Modify: `src/renderer/lib/auth-client.ts`

**Step 1: Remove BILLING_ENABLED from shared-constants.ts**

```typescript
// REMOVE from FEATURE_FLAGS:
/** Gates access to billing features. */
BILLING_ENABLED: "billing-enabled",
```

**Step 2: Remove Stripe client from auth-client.ts**

```typescript
// REMOVE this import:
import { stripeClient } from "@better-auth/stripe/client";

// REMOVE from plugins array:
stripeClient({ subscription: true }),
```

**Step 3: Commit**

```bash
git add src/shared/shared-constants.ts src/renderer/lib/auth-client.ts
git commit -m "chore: remove billing feature flag and Stripe client"
```

---

## Phase 2: Remove Organization and Member Management

### Task 5: Delete organization and member settings routes

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/organization/` (entire directory)
- Delete: `src/renderer/routes/_authenticated/settings/members/` (entire directory)
- Delete: `src/renderer/routes/_authenticated/settings/team/` (entire directory)

**Step 1: Remove organization settings directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/organization
```

**Step 2: Remove members settings directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/members
```

**Step 3: Remove team settings directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/team
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove organization, members, and team settings routes"
```

---

### Task 6: Remove organization from settings sidebar

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx`

**Step 1: Edit GeneralSettings.tsx to remove organization section**

Remove the organization entry from `GENERAL_SECTIONS` array:

```typescript
// REMOVE this object from GENERAL_SECTIONS array:
{
  id: "/settings/organization",
  section: "organization",
  label: "Organization",
  icon: <HiOutlineBuildingOffice2 className="h-4 w-4" />,
},
```

Also remove the unused import `HiOutlineBuildingOffice2`.

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx
git commit -m "chore: remove organization from settings sidebar"
```

---

### Task 7: Delete create-organization route

**Files:**
- Delete: `src/renderer/routes/create-organization/` (entire directory)

**Step 1: Remove create-organization directory**

```bash
rm -rf src/renderer/routes/create-organization
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove create-organization route"
```

---

### Task 8: Remove shared auth authorization modules

**Files:**
- Delete: `src/shared/auth/` (entire directory)

**Step 1: Remove shared auth directory**

```bash
rm -rf src/shared/auth
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove shared auth authorization modules"
```

---

## Phase 3: Remove Account Settings

### Task 9: Delete account settings route

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/account/` (entire directory)

**Step 1: Remove account settings directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/account
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove account settings route"
```

---

### Task 10: Remove account from settings sidebar

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx`

**Step 1: Edit GeneralSettings.tsx to remove account section**

Remove the account entry from `GENERAL_SECTIONS` array:

```typescript
// REMOVE this object from GENERAL_SECTIONS array:
{
  id: "/settings/account",
  section: "account",
  label: "Account",
  icon: <HiOutlineUser className="h-4 w-4" />,
},
```

Also remove the unused import `HiOutlineUser`.

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx
git commit -m "chore: remove account from settings sidebar"
```

---

## Phase 4: Remove API Keys and Devices (Auth-Dependent)

### Task 11: Delete API keys and devices routes

**Files:**
- Delete: `src/renderer/routes/_authenticated/settings/api-keys/` (entire directory)
- Delete: `src/renderer/routes/_authenticated/settings/devices/` (entire directory)

**Step 1: Remove api-keys directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/api-keys
```

**Step 2: Remove devices directory**

```bash
rm -rf src/renderer/routes/_authenticated/settings/devices
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove api-keys and devices settings routes"
```

---

### Task 12: Remove api-keys and devices from settings sidebar

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx`

**Step 1: Edit GeneralSettings.tsx to remove api-keys and devices sections**

Remove these entries from `GENERAL_SECTIONS` array:

```typescript
// REMOVE these objects from GENERAL_SECTIONS array:
{
  id: "/settings/devices",
  section: "devices",
  label: "Devices",
  icon: <HiOutlineDevicePhoneMobile className="h-4 w-4" />,
},
{
  id: "/settings/api-keys",
  section: "apikeys",
  label: "API Keys",
  icon: <HiOutlineKey className="h-4 w-4" />,
},
```

Also remove the unused imports `HiOutlineDevicePhoneMobile` and `HiOutlineKey`.

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/components/SettingsSidebar/GeneralSettings.tsx
git commit -m "chore: remove api-keys and devices from settings sidebar"
```

---

## Phase 5: Remove Sign-In Route

### Task 13: Delete sign-in route

**Files:**
- Delete: `src/renderer/routes/sign-in/` (entire directory)

**Step 1: Remove sign-in directory**

```bash
rm -rf src/renderer/routes/sign-in
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove sign-in route"
```

---

## Phase 6: Replace OrganizationDropdown with AppMenu

### Task 14: Create AppMenu component to replace OrganizationDropdown

**Files:**
- Modify: `src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/OrganizationDropdown/OrganizationDropdown.tsx`

**Step 1: Replace OrganizationDropdown with simplified AppMenu**

Replace the entire file with a simplified menu that removes auth-related features but keeps settings and help links:

```typescript
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
import { useNavigate } from "@tanstack/react-router";
import { FaDiscord, FaGithub, FaXTwitter } from "react-icons/fa6";
import {
  HiOutlineBookOpen,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCog6Tooth,
  HiOutlineEnvelope,
} from "react-icons/hi2";
import { IoBugOutline } from "react-icons/io5";
import { LuKeyboard, LuSettings2 } from "react-icons/lu";
import { useHotkeyText } from "renderer/stores/hotkeys";

export function AppMenu() {
  const navigate = useNavigate();
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
          onSelect={() => navigate({ to: "/settings/appearance" })}
        >
          <HiOutlineCog6Tooth className="h-4 w-4" />
          <span>Settings</span>
          {settingsHotkey !== "Unassigned" && (
            <DropdownMenuShortcut>{settingsHotkey}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Help & Support */}
        <DropdownMenuItem onClick={() => openExternal(COMPANY.DOCS_URL)}>
          <HiOutlineBookOpen className="h-4 w-4" />
          Documentation
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate({ to: "/settings/keyboard" })}
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
            <DropdownMenuItem onClick={() => openExternal(COMPANY.DISCORD_URL)}>
              <FaDiscord className="h-4 w-4" />
              Discord
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
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/OrganizationDropdown/OrganizationDropdown.tsx
git commit -m "feat: replace OrganizationDropdown with simplified AppMenu"
```

---

### Task 15: Update TopBar to use AppMenu

**Files:**
- Modify: `src/renderer/routes/_authenticated/_dashboard/components/TopBar/TopBar.tsx`

**Step 1: Update import and component name**

```typescript
// CHANGE this import:
import { OrganizationDropdown } from "./components/OrganizationDropdown";
// TO:
import { AppMenu } from "./components/OrganizationDropdown";

// CHANGE in JSX:
<OrganizationDropdown />
// TO:
<AppMenu />
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/_dashboard/components/TopBar/TopBar.tsx
git commit -m "chore: update TopBar to use AppMenu"
```

---

### Task 16: Rename OrganizationDropdown directory to AppMenu

**Files:**
- Rename: `src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/OrganizationDropdown/` -> `AppMenu/`

**Step 1: Rename directory and update file name**

```bash
mv src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/OrganizationDropdown src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/AppMenu
mv src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/AppMenu/OrganizationDropdown.tsx src/renderer/routes/_authenticated/_dashboard/components/TopBar/components/AppMenu/AppMenu.tsx
```

**Step 2: Update import in TopBar.tsx**

```typescript
// CHANGE:
import { AppMenu } from "./components/OrganizationDropdown";
// TO:
import { AppMenu } from "./components/AppMenu";
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename OrganizationDropdown to AppMenu"
```

---

## Phase 7: Remove Auth Guards and Simplify Layout

### Task 17: Remove auth guards from authenticated layout

**Files:**
- Modify: `src/renderer/routes/_authenticated/layout.tsx`

**Step 1: Remove auth checks and redirects**

Update the layout to remove session checks and always render content:

```typescript
import {
  createFileRoute,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { DndProvider } from "react-dnd";
import { NewWorkspaceModal } from "renderer/components/NewWorkspaceModal";
import { useUpdateListener } from "renderer/components/UpdateToast";
import { dragDropManager } from "renderer/lib/dnd";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { WorkspaceInitEffects } from "renderer/screens/main/components/WorkspaceInitEffects";
import { useHotkeysSync } from "renderer/stores/hotkeys";
import { useAgentHookListener } from "renderer/stores/tabs/useAgentHookListener";
import { useWorkspaceInitStore } from "renderer/stores/workspace-init";
import { AgentHooks } from "./components/AgentHooks";
import { CollectionsProvider } from "./providers/CollectionsProvider";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const utils = electronTrpc.useUtils();

  // Global hooks and subscriptions
  useAgentHookListener();
  useUpdateListener();
  useHotkeysSync();

  // Workspace initialization progress subscription
  const updateInitProgress = useWorkspaceInitStore((s) => s.updateProgress);
  electronTrpc.workspaces.onInitProgress.useSubscription(undefined, {
    onData: (progress) => {
      updateInitProgress(progress);
      if (progress.step === "ready" || progress.step === "failed") {
        utils.workspaces.getAllGrouped.invalidate();
        utils.workspaces.get.invalidate({ id: progress.workspaceId });
      }
    },
    onError: (error) => {
      console.error("[workspace-init-subscription] Subscription error:", error);
    },
  });

  // Menu navigation subscription
  electronTrpc.menu.subscribe.useSubscription(undefined, {
    onData: (event) => {
      if (event.type === "open-settings") {
        const section = event.data.section || "appearance";
        navigate({ to: `/settings/${section}` as "/settings/appearance" });
      } else if (event.type === "open-workspace") {
        navigate({ to: `/workspace/${event.data.workspaceId}` });
      }
    },
  });

  return (
    <DndProvider manager={dragDropManager}>
      <CollectionsProvider>
        <AgentHooks />
        <Outlet />
        <WorkspaceInitEffects />
        <NewWorkspaceModal />
      </CollectionsProvider>
    </DndProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/layout.tsx
git commit -m "chore: remove auth guards from authenticated layout"
```

---

## Phase 8: Remove Auth tRPC Router

### Task 18: Remove auth router from tRPC

**Files:**
- Delete: `src/lib/trpc/routers/auth/` (entire directory)
- Modify: Main tRPC router file to remove auth router import

**Step 1: Find and read the main tRPC router file to understand structure**

First, locate the main router file that imports createAuthRouter.

**Step 2: Remove auth directory**

```bash
rm -rf src/lib/trpc/routers/auth
```

**Step 3: Update main tRPC router to remove auth router**

Remove the import and usage of createAuthRouter from the main router file.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove auth tRPC router"
```

---

## Phase 9: Remove Auth Client

### Task 19: Remove auth-client and related imports

**Files:**
- Delete: `src/renderer/lib/auth-client.ts`
- Delete: `src/lib/auth-types.ts`

**Step 1: Remove auth-client file**

```bash
rm src/renderer/lib/auth-client.ts
```

**Step 2: Remove auth-types file**

```bash
rm src/lib/auth-types.ts
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove auth-client and auth-types"
```

---

## Phase 10: Remove PostHog User Identifier

### Task 20: Remove PostHogUserIdentifier component

**Files:**
- Delete: `src/renderer/components/PostHogUserIdentifier/` (entire directory)

**Step 1: Remove PostHogUserIdentifier directory**

```bash
rm -rf src/renderer/components/PostHogUserIdentifier
```

**Step 2: Find and remove any imports of this component**

Search for imports and remove them from any files.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove PostHogUserIdentifier component"
```

---

## Phase 11: Clean Up Shared Constants

### Task 21: Remove auth-related constants

**Files:**
- Modify: `src/shared/shared-constants.ts`

**Step 1: Remove auth-related exports**

Remove these from the file:

```typescript
// REMOVE:
export const AUTH_PROVIDERS = ["github", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

// REMOVE:
export const PROTOCOL_SCHEMES = {
  DEV: "caspian-dev",
  PROD: "caspian",
} as const;

// REMOVE:
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 60 * 60,
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60,
  REFRESH_THRESHOLD: 5 * 60,
} as const;
```

**Step 2: Commit**

```bash
git add src/shared/shared-constants.ts
git commit -m "chore: remove auth-related constants"
```

---

## Phase 12: Update Default Settings Route

### Task 22: Update settings page default redirect

**Files:**
- Modify: `src/renderer/routes/_authenticated/settings/page.tsx`

**Step 1: Update default settings redirect**

Change the default settings route from `/settings/account` to `/settings/appearance`:

```typescript
// Change redirect from "/settings/account" to "/settings/appearance"
```

**Step 2: Commit**

```bash
git add src/renderer/routes/_authenticated/settings/page.tsx
git commit -m "chore: update default settings redirect to appearance"
```

---

## Phase 13: Update Root Route

### Task 23: Update root route to redirect directly to workspace

**Files:**
- Modify: `src/renderer/routes/__root.tsx`

**Step 1: Read and update root route**

Update the root route to redirect directly to `/workspace` instead of going through auth checks.

**Step 2: Commit**

```bash
git add src/renderer/routes/__root.tsx
git commit -m "chore: update root route to redirect to workspace"
```

---

## Phase 14: Remove Database Auth Schema (Optional - if local DB)

### Task 24: Review and potentially remove auth schema

**Files:**
- Review: `src/lib/db/schema/auth.ts`

**Step 1: Assess if auth schema is used**

Determine if the auth schema is:
1. Used by a remote API (keep as reference)
2. Used locally (can be removed)
3. Has dependencies in other parts of the app

**Step 2: If safe to remove, delete the file**

```bash
rm src/lib/db/schema/auth.ts
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove auth database schema"
```

---

## Phase 15: Final Cleanup and Testing

### Task 25: Remove any remaining auth imports and fix TypeScript errors

**Files:**
- Various files that may still import auth-related modules

**Step 1: Run TypeScript compiler to find errors**

```bash
npm run typecheck
```

**Step 2: Fix any remaining import errors**

Search for and remove any remaining imports of:
- `authClient`
- `auth-client`
- `auth-types`
- Organization-related hooks
- Session-related hooks

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: fix remaining auth-related imports"
```

---

### Task 26: Test the application

**Step 1: Build the application**

```bash
npm run build
```

**Step 2: Run development mode**

```bash
npm run dev
```

**Step 3: Verify**

- App launches directly to workspace (no sign-in)
- Settings menu works and shows only remaining sections
- AppMenu dropdown works
- No console errors related to missing auth modules

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete auth and billing removal"
```

---

## Summary of Removed Features

After completing this plan:

1. **Removed Routes:**
   - `/sign-in`
   - `/create-organization`
   - `/settings/account`
   - `/settings/organization`
   - `/settings/members`
   - `/settings/billing`
   - `/settings/api-keys`
   - `/settings/devices`

2. **Removed Components:**
   - Paywall
   - OrganizationDropdown (replaced with AppMenu)
   - PostHogUserIdentifier

3. **Removed Backend:**
   - Auth tRPC router
   - Auth client
   - Token management

4. **Simplified:**
   - Authenticated layout (no auth guards)
   - Settings sidebar (fewer sections)
   - App menu (no user/org switching)

5. **Remaining Settings Sections:**
   - Appearance
   - Notifications (Ringtones)
   - Keyboard
   - Features (Behavior)
   - Terminal
   - Integrations
   - Project settings
