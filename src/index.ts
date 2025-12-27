#!/usr/bin/env bun
import type { CliRenderer } from "@opentui/core";
import { createCliRenderer } from "@opentui/core";
import {
	loadConfigStore,
	loadDataStore,
	saveConfigStore,
	saveDataStore,
} from "./data/store";
import {
	checkSyncNeeded,
	syncAll,
	updateLastSyncTime,
} from "./integrations/sync-manager";
import type { ConfigStore, DataStore } from "./schema";
import type { Theme } from "./ui/theme";
import { getTheme } from "./ui/theme";
import { IntegrationSetup } from "./ui/views/IntegrationSetup";
import { TaskListView } from "./ui/views/TaskListView";

let currentView: TaskListView | null = null;

function showTaskList(
	renderer: CliRenderer,
	theme: Theme,
	dataStore: DataStore,
	configStore: ConfigStore,
) {
	const showSetup = () => {
		currentView?.destroy();
		currentView = null;
		new IntegrationSetup(renderer, theme, configStore, () =>
			showTaskList(renderer, theme, dataStore, configStore),
		);
	};

	currentView = new TaskListView(
		renderer,
		theme,
		dataStore,
		() => {
			currentView?.destroy();
			renderer.destroy();
		},
		showSetup,
	);
}

async function main() {
	const renderer = await createCliRenderer({
		exitOnCtrlC: true,
		targetFps: 30,
	});

	const [dataStore, configStore] = await Promise.all([
		loadDataStore(),
		loadConfigStore(),
	]);

	if (await checkSyncNeeded(configStore)) {
		try {
			const result = await syncAll(configStore, dataStore);

			for (const service of result.succeededServices) {
				updateLastSyncTime(configStore, service);
			}

			if (result.newTasks.length > 0 || result.updatedTasks.length > 0) {
				await saveDataStore(dataStore);
			}

			if (result.succeededServices.length > 0) {
				await saveConfigStore(configStore);
			}
		} catch (error) {
			console.error("Startup sync failed:", error);
		}
	}

	const theme = await getTheme(renderer, configStore.theme);
	renderer.setBackgroundColor(theme.bg);

	showTaskList(renderer, theme, dataStore, configStore);
}

main().catch(console.error);
