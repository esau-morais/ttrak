#!/usr/bin/env bun
import type { CliRenderer } from "@opentui/core";
import { createCliRenderer } from "@opentui/core";
import { loadDataStore, loadConfigStore, saveDataStore, saveConfigStore } from "./data/store";
import { getTheme } from "./ui/theme";
import type { Theme } from "./ui/theme";
import { TaskListView } from "./ui/views/TaskListView";
import { IntegrationSetup } from "./ui/views/IntegrationSetup";
import { syncAll, checkSyncNeeded, updateLastSyncTime } from "./integrations/sync-manager";
import type { DataStore, ConfigStore } from "./schema";

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
    new IntegrationSetup(
      renderer,
      theme,
      configStore,
      () => showTaskList(renderer, theme, dataStore, configStore),
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
      
      if (result.errors.length === 0 && (result.newTasks.length > 0 || result.updatedTasks.length > 0)) {
        if (configStore.integrations?.github) {
          updateLastSyncTime(configStore, "github");
        }
        if (configStore.integrations?.linear) {
          updateLastSyncTime(configStore, "linear");
        }
        await Promise.all([
          saveDataStore(dataStore),
          saveConfigStore(configStore),
        ]);
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
