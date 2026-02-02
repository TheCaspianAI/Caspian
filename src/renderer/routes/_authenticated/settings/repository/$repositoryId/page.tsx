import { createFileRoute, notFound } from "@tanstack/react-router";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { NotFound } from "renderer/routes/not-found";
import { RepositorySettings } from "./components/RepositorySettings";

export const Route = createFileRoute(
	"/_authenticated/settings/repository/$repositoryId/",
)({
	component: RepositorySettingsPage,
	notFoundComponent: NotFound,
	loader: async ({ params, context }) => {
		const repositoryQueryKey = [
			["repositories", "get"],
			{ input: { id: params.repositoryId }, type: "query" },
		];

		const configQueryKey = [
			["config", "getConfigFilePath"],
			{ input: { repositoryId: params.repositoryId }, type: "query" },
		];

		try {
			await Promise.all([
				context.queryClient.ensureQueryData({
					queryKey: repositoryQueryKey,
					queryFn: () =>
						electronTrpcClient.repositories.get.query({ id: params.repositoryId }),
				}),
				context.queryClient.ensureQueryData({
					queryKey: configQueryKey,
					queryFn: () =>
						electronTrpcClient.config.getConfigFilePath.query({
							repositoryId: params.repositoryId,
						}),
				}),
			]);
		} catch (error) {
			// If repository not found, throw notFound() to render 404 page
			if (error instanceof Error && error.message.includes("not found")) {
				throw notFound();
			}
			// Re-throw other errors
			throw error;
		}
	},
});

function RepositorySettingsPage() {
	const { repositoryId } = Route.useParams();
	return <RepositorySettings repositoryId={repositoryId} />;
}
