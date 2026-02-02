import { createFileRoute } from "@tanstack/react-router";
import { NodesListView } from "renderer/screens/main/components/NodesListView/NodesListView";

export const Route = createFileRoute("/_authenticated/_dashboard/workspaces/")({
	component: WorkspacesPage,
});

function WorkspacesPage() {
	return <NodesListView />;
}
