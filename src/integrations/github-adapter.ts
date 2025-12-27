import type { Task } from "../schema";

export interface GitHubConfig {
	token: string;
	repo: string;
	syncInterval?: number;
}

interface GitHubIssue {
	number: number;
	title: string;
	body: string | null;
	state: "open" | "closed";
	labels: Array<{ name: string }>;
	html_url: string;
	created_at: string;
	updated_at: string;
	pull_request?: unknown;
}

interface GitHubResponse {
	data: GitHubIssue[];
	rateLimit: {
		remaining: number;
		reset: number;
	};
}

function inferPriorityFromLabels(
	labels: Array<{ name: string }>,
): Task["priority"] {
	const labelNames = labels.map((l) => l.name.toLowerCase());
	if (labelNames.some((n) => n.includes("urgent") || n.includes("critical")))
		return "urgent";
	if (labelNames.some((n) => n.includes("high"))) return "high";
	if (labelNames.some((n) => n.includes("medium"))) return "medium";
	if (labelNames.some((n) => n.includes("low"))) return "low";
	return "none";
}

function mapGitHubStatusToTask(state: string): Task["status"] {
	return state === "open" ? "todo" : "done";
}

export async function fetchGitHubIssues(
	config: GitHubConfig,
	since?: string,
): Promise<GitHubResponse> {
	const [owner, repo] = config.repo.split("/");
	if (!owner || !repo) {
		throw new Error(
			`Invalid repo format: ${config.repo}. Expected "owner/repo"`,
		);
	}

	const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
	url.searchParams.set("state", "all");
	url.searchParams.set("per_page", "100");
	if (since) {
		url.searchParams.set("since", since);
	}

	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${config.token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "ttrak-tui",
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("GitHub authentication failed. Check your token.");
		}
		if (response.status === 404) {
			throw new Error(`Repository not found: ${config.repo}`);
		}
		if (response.status === 403) {
			const resetTime = response.headers.get("x-ratelimit-reset");
			throw new Error(
				`Rate limit exceeded. Resets at ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : "unknown"}`,
			);
		}
		throw new Error(
			`GitHub API error: ${response.status} ${response.statusText}`,
		);
	}

	const data = (await response.json()) as GitHubIssue[];
	const rateLimit = {
		remaining: parseInt(response.headers.get("x-ratelimit-remaining") || "0"),
		reset: parseInt(response.headers.get("x-ratelimit-reset") || "0"),
	};

	return { data, rateLimit };
}

export function transformGitHubIssueToTask(
	issue: GitHubIssue,
	repo: string,
): Task {
	const isPR = !!issue.pull_request;
	const syncedAt = new Date().toISOString();

	return {
		id: `GH-${issue.number}`,
		title: issue.title,
		description: issue.body || undefined,
		status: mapGitHubStatusToTask(issue.state),
		priority: inferPriorityFromLabels(issue.labels),
		source: "github",
		externalId: `github:${repo}:${issue.number}`,
		createdAt: issue.created_at,
		updatedAt: issue.updated_at,
		github: {
			type: isPR ? "pr" : "issue",
			number: issue.number,
			repo,
			url: issue.html_url,
			externalStatus: issue.state,
			syncedAt,
		},
		tags: issue.labels.map((l) => l.name),
	};
}

export async function syncGitHub(
	config: GitHubConfig,
	lastSync?: string,
): Promise<Task[]> {
	try {
		const response = await fetchGitHubIssues(config, lastSync);
		const issues = response.data.filter((issue) => !issue.pull_request);
		return issues.map((issue) =>
			transformGitHubIssueToTask(issue, config.repo),
		);
	} catch (error) {
		console.error("GitHub sync failed:", error);
		return [];
	}
}
