import { useTheme } from "renderer/stores/theme/store";
import { Toaster } from "ui/components/ui/sonner";

export function ThemedToaster() {
	const theme = useTheme();
	return <Toaster theme={theme?.type ?? "dark"} />;
}
