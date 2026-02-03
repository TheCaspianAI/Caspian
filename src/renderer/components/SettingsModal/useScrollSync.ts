import { useEffect, useRef, useState, useCallback } from "react";
import type { SettingsSection } from "renderer/stores/settings-state";

const SECTION_IDS: SettingsSection[] = [
	"appearance",
	"preferences",
	"presets",
	"sessions",
	"repository",
];

interface UseScrollSyncOptions {
	containerRef: React.RefObject<HTMLElement | null>;
}

export function useScrollSync({ containerRef }: UseScrollSyncOptions) {
	const [activeSection, setActiveSection] =
		useState<SettingsSection>("appearance");
	const sectionRefs = useRef<Map<SettingsSection, HTMLElement>>(new Map());
	const isScrollingRef = useRef(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [sectionCount, setSectionCount] = useState(0);

	// Register section ref
	const registerSection = useCallback(
		(id: SettingsSection, element: HTMLElement | null) => {
			if (element) {
				sectionRefs.current.set(id, element);
			} else {
				sectionRefs.current.delete(id);
			}
			// Trigger re-observe by updating count
			setSectionCount(sectionRefs.current.size);
		},
		[]
	);

	// Scroll to section
	const scrollToSection = useCallback(
		(id: SettingsSection) => {
			const element = sectionRefs.current.get(id);
			const container = containerRef.current;
			if (!element || !container) return;

			isScrollingRef.current = true;
			setActiveSection(id);

			element.scrollIntoView({ behavior: "smooth", block: "start" });

			// Clear any pending timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			// Reset scrolling flag after animation
			timeoutRef.current = setTimeout(() => {
				isScrollingRef.current = false;
			}, 500);
		},
		[containerRef]
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	// Observe scroll position and update active section
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (isScrollingRef.current) return;

				// Find the topmost visible section
				const visibleSections: { id: SettingsSection; ratio: number }[] = [];

				for (const entry of entries) {
					if (entry.isIntersecting) {
						const id = entry.target.getAttribute(
							"data-settings-section"
						) as SettingsSection;
						if (id) {
							visibleSections.push({ id, ratio: entry.intersectionRatio });
						}
					}
				}

				if (visibleSections.length > 0) {
					// Sort by order in SECTION_IDS, pick first visible
					visibleSections.sort(
						(a, b) => SECTION_IDS.indexOf(a.id) - SECTION_IDS.indexOf(b.id)
					);
					setActiveSection(visibleSections[0].id);
				}
			},
			{
				root: container,
				threshold: [0, 0.25, 0.5, 0.75, 1],
				rootMargin: "-20% 0px -60% 0px",
			}
		);

		// Observe all registered sections
		for (const element of sectionRefs.current.values()) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	}, [containerRef, sectionCount]);

	return {
		activeSection,
		registerSection,
		scrollToSection,
	};
}
