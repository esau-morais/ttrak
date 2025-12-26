#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { loadDataStore, loadConfigStore } from "./data/store";
import { getTheme } from "./ui/theme";
import { TaskListView } from "./ui/views/TaskListView";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  });

  const [dataStore, configStore] = await Promise.all([
    loadDataStore(),
    loadConfigStore(),
  ]);

  const theme = await getTheme(renderer, configStore.theme);
  renderer.setBackgroundColor(theme.bg);

  const view = new TaskListView(renderer, theme, dataStore, () => {
    view.destroy();
    renderer.destroy();
  });
}

main().catch(console.error);
