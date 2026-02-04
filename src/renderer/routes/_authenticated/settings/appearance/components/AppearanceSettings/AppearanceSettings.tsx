import {
	type MarkdownStyle,
	useMarkdownStyle,
	useSetMarkdownStyle,
} from "renderer/stores/markdown-preferences";
import { useSetTheme, useThemeId, useThemeStore } from "renderer/stores/theme";
import { builtInThemes } from "shared/themes";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { isItemVisible, SETTING_ITEM_ID, type SettingItemId } from "../../../utils/settings-search";
import { ThemeCard } from "./components/ThemeCard";

interface AppearanceSettingsProps {
	visibleItems?: SettingItemId[] | null;
}

export function AppearanceSettings({ visibleItems }: AppearanceSettingsProps) {
	const showTheme = isItemVisible(SETTING_ITEM_ID.APPEARANCE_THEME, visibleItems);
	const showMarkdown = isItemVisible(SETTING_ITEM_ID.APPEARANCE_MARKDOWN, visibleItems);
	const showCustomThemes = isItemVisible(SETTING_ITEM_ID.APPEARANCE_CUSTOM_THEMES, visibleItems);

	const activeThemeId = useThemeId();
	const setTheme = useSetTheme();
	const customThemes = useThemeStore((state) => state.customThemes);
	const markdownStyle = useMarkdownStyle();
	const setMarkdownStyle = useSetMarkdownStyle();

	const allThemes = [...builtInThemes, ...customThemes];

	return (
		<div className="space-y-8">
			{/* Theme Section */}
			{showTheme && (
				<div>
					<h3 className="text-sm font-medium mb-4">Interface Theme</h3>
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
						{allThemes.map((theme) => (
							<ThemeCard
								key={theme.id}
								theme={theme}
								isSelected={activeThemeId === theme.id}
								onSelect={() => setTheme(theme.id)}
							/>
						))}
					</div>
				</div>
			)}

			{showMarkdown && (
				<div className={showTheme ? "pt-6 border-t" : ""}>
					<h3 className="text-sm font-medium mb-2">Markdown Rendering</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Configure how markdown content is displayed
					</p>
					<Select
						value={markdownStyle}
						onValueChange={(value) => setMarkdownStyle(value as MarkdownStyle)}
					>
						<SelectTrigger className="w-[200px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="default">Default</SelectItem>
							<SelectItem value="tufte">Tufte</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground mt-2">
						Tufte style uses elegant serif typography inspired by Edward Tufte's books
					</p>
				</div>
			)}

			{showCustomThemes && (
				<div className={showTheme || showMarkdown ? "pt-6 border-t" : ""}>
					<h3 className="text-sm font-medium mb-2">Custom Themes</h3>
					<p className="text-sm text-muted-foreground">
						Custom theme import coming soon. You'll be able to import JSON theme files to create
						your own themes.
					</p>
				</div>
			)}
		</div>
	);
}
