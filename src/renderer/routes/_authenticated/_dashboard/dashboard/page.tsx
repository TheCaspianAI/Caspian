import { createFileRoute } from "@tanstack/react-router";
import { KanbanView } from "renderer/screens/main/components/NodeView/ContentView/TabsContent/KanbanView/KanbanView";

export const Route = createFileRoute("/_authenticated/_dashboard/dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	return <KanbanView />;
}
