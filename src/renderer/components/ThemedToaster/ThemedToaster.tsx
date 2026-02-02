import { Toaster } from "ui/components/ui/sonner";
import { useTheme } from "renderer/stores/theme/store";

export function ThemedToaster() {
	const theme = useTheme();
	return <Toaster theme={theme?.type ?? "dark"} />;
}
