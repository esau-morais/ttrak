import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import { DataStoreSchema, ConfigStoreSchema, type DataStore, type ConfigStore } from "../schema";

const CONFIG_DIR = join(homedir(), ".config", "trak");
const DATA_PATH = join(CONFIG_DIR, "data.json");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function loadDataStore(): Promise<DataStore> {
  await ensureConfigDir();

  try {
    const raw = await Bun.file(DATA_PATH).text();
    const data = JSON.parse(raw);
    const result = DataStoreSchema.safeParse(data);

    if (!result.success) {
      console.error("Invalid data store:", result.error);
      return DataStoreSchema.parse({});
    }

    return result.data;
  } catch (error) {
    return DataStoreSchema.parse({});
  }
}

export async function saveDataStore(store: DataStore): Promise<void> {
  await ensureConfigDir();

  const { $schema, ...rest } = store;
  const output = {
    $schema: "./data.schema.json",
    ...rest,
  };

  await Bun.write(DATA_PATH, JSON.stringify(output, null, 2));
}

export async function loadConfigStore(): Promise<ConfigStore> {
  await ensureConfigDir();

  try {
    const raw = await Bun.file(CONFIG_PATH).text();
    const data = JSON.parse(raw);
    const result = ConfigStoreSchema.safeParse(data);

    if (!result.success) {
      console.error("Invalid config store:", result.error);
      return ConfigStoreSchema.parse({});
    }

    return result.data;
  } catch (error) {
    return ConfigStoreSchema.parse({});
  }
}

export async function saveConfigStore(store: ConfigStore): Promise<void> {
  await ensureConfigDir();

  const output = {
    ...store,
    $schema: "./config.schema.json",
  };

  await Bun.write(CONFIG_PATH, JSON.stringify(output, null, 2));
}

export function getDataPath(): string {
  return DATA_PATH;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
