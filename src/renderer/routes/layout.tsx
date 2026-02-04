import type { ReactNode } from "react";
import { ThemedToaster } from "renderer/components/ThemedToaster";
import { ElectronTRPCProvider } from "renderer/providers/ElectronTRPCProvider";
import { MonacoProvider } from "renderer/providers/MonacoProvider";
import { PostHogProvider } from "renderer/providers/PostHogProvider";
import { Alerter } from "ui/atoms/Alert";

export function RootLayout({ children }: { children: ReactNode }) {
	return (
		<PostHogProvider>
			<ElectronTRPCProvider>
				<MonacoProvider>
					{children}
					<ThemedToaster />
					<Alerter />
				</MonacoProvider>
			</ElectronTRPCProvider>
		</PostHogProvider>
	);
}
