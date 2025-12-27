import type { ConfigStore, DataStore, Task } from "../schema";
import { syncGitHub } from "./github-adapter";
import { syncLinear } from "./linear-adapter";

export interface SyncResult {
	newTasks: Task[];
	updatedTasks: Task[];
	errors: string[];
}

export async function syncAll(
	config: ConfigStore,
	store: DataStore,
): Promise<SyncResult> {
	const result: SyncResult = {
		newTasks: [],
		updatedTasks: [],
		errors: [],
	};

	if (!config.integrations?.sync?.enabled) {
		return result;
	}

	const syncPromises: Promise<void>[] = [];

	if (config.integrations.github) {
		syncPromises.push(
			syncGitHub(config.integrations.github)
				.then((tasks) => {
					mergeTasks(tasks, store, result);
				})
				.catch((error) => {
					result.errors.push(`GitHub: ${error.message}`);
				}),
		);
	}

	if (config.integrations.linear) {
		syncPromises.push(
			syncLinear(config.integrations.linear)
				.then((tasks) => {
					mergeTasks(tasks, store, result);
				})
				.catch((error) => {
					result.errors.push(`Linear: ${error.message}`);
				}),
		);
	}

	await Promise.all(syncPromises);

	return result;
}

function mergeTasks(
	syncedTasks: Task[],
	store: DataStore,
	result: SyncResult,
): void {
	const existingExternalIds = new Map(
		store.tasks.filter((t) => t.externalId).map((t, i) => [t.externalId!, i]),
	);

	for (const task of syncedTasks) {
		if (!task.externalId) continue;

		const existingIndex = existingExternalIds.get(task.externalId);
		if (existingIndex !== undefined) {
			const existing = store.tasks[existingIndex];
			if (!existing) continue;

			if (new Date(task.updatedAt) > new Date(existing.updatedAt)) {
				store.tasks[existingIndex] = {
					...task,
					status: existing.status,
					priority: existing.priority,
				};
				result.updatedTasks.push(task);
			}
		} else {
			store.tasks.push(task);
			result.newTasks.push(task);
		}
	}
}

export async function checkSyncNeeded(config: ConfigStore): Promise<boolean> {
	if (!config.integrations?.sync?.enabled) return false;

	const lastSyncTimes = config.integrations.sync.lastSync || {};
	const now = Date.now();

	const githubNeeded =
		config.integrations.github &&
		(!lastSyncTimes.github ||
			now - new Date(lastSyncTimes.github).getTime() >
				config.integrations.github.syncInterval * 60 * 1000);

	const linearNeeded =
		config.integrations.linear &&
		(!lastSyncTimes.linear ||
			now - new Date(lastSyncTimes.linear).getTime() >
				config.integrations.linear.syncInterval * 60 * 1000);

	return !!(githubNeeded || linearNeeded);
}

export function updateLastSyncTime(
	config: ConfigStore,
	service: "github" | "linear",
): void {
	if (!config.integrations) {
		config.integrations = {};
	}
	if (!config.integrations.sync) {
		config.integrations.sync = { enabled: true };
	}
	if (!config.integrations.sync.lastSync) {
		config.integrations.sync.lastSync = {};
	}
	config.integrations.sync.lastSync[service] = new Date().toISOString();
}
