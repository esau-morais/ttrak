import { type Issue, LinearClient } from "@linear/sdk";
import type { Task } from "../schema";

export interface LinearConfig {
	apiKey: string;
	teamId?: string;
	syncInterval?: number;
	syncOnlyAssigned?: boolean;
}

function inferPriorityFromLinear(priority: number): Task["priority"] {
	if (priority === 0) return "none";
	if (priority === 1) return "urgent";
	if (priority === 2) return "high";
	if (priority === 3) return "medium";
	if (priority === 4) return "low";
	return "none";
}

function mapLinearStatusToTask(stateName: string): Task["status"] {
	const lower = stateName.toLowerCase();
	if (lower.includes("backlog") || lower.includes("todo")) return "todo";
	if (lower.includes("progress") || lower.includes("review"))
		return "inProgress";
	if (lower.includes("done") || lower.includes("complete")) return "done";
	if (lower.includes("cancel")) return "cancelled";
	return "todo";
}

export async function fetchLinearIssues(
	config: LinearConfig,
): Promise<Issue[]> {
	const client = new LinearClient({ apiKey: config.apiKey });

	try {
		type IssuesVariables = Parameters<typeof client.issues>[number];
		const variables: IssuesVariables = {};

		if (config.syncOnlyAssigned || config.teamId) {
			const me = await client.viewer;
			variables.filter = {};

			if (config.syncOnlyAssigned) {
				variables.filter.assignee = { id: { eq: me.id } };
			}
			if (config.teamId) {
				variables.filter.team = { id: { eq: config.teamId } };
			}
		}

		const issuesConnection = await client.issues(variables);
		const issues = issuesConnection.nodes;

		return issues;
	} catch (error) {
		if (error instanceof Error && error.message.includes("Invalid API key")) {
			throw new Error("Linear authentication failed. Check your API key.");
		}
		throw error;
	}
}

export async function transformLinearIssueToTask(issue: Issue): Promise<Task> {
	const syncedAt = new Date().toISOString();
	const state = await issue.state;
	const team = await issue.team;
	const labels = await issue.labels();

	return {
		id: `${team?.key || "LIN"}-${issue.number}`,
		title: issue.title,
		description: issue.description || undefined,
		status: mapLinearStatusToTask(state?.name || ""),
		priority: inferPriorityFromLinear(issue.priority),
		source: "linear",
		externalId: `linear:${team?.id}:${issue.id}`,
		createdAt: issue.createdAt.toISOString(),
		updatedAt: issue.updatedAt.toISOString(),
		linear: {
			id: issue.id,
			url: issue.url,
			teamId: team?.id,
			externalStatus: state?.name,
			syncedAt,
		},
		tags: labels?.nodes.map((l) => l.name) || [],
		dueDate: issue.dueDate?.toISOString(),
	};
}

export async function syncLinear(config: LinearConfig): Promise<Task[]> {
	try {
		const issues = await fetchLinearIssues(config);
		const tasks = await Promise.all(
			issues.map((issue) => transformLinearIssueToTask(issue)),
		);
		return tasks;
	} catch (error) {
		console.error(
			"Linear sync failed:",
			error instanceof Error ? error.message : String(error),
		);
		throw error;
	}
}
