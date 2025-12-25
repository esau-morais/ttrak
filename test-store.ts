import { loadDataStore } from "./src/data/store";

const store = await loadDataStore();
console.log("Loaded store:");
console.log(JSON.stringify(store, null, 2));
console.log(`\nTasks: ${store.tasks.length}`);
