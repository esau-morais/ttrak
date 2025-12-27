import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import {
  DataStoreSchema,
  ConfigStoreSchema,
  type DataStore,
  type ConfigStore,
} from "../schema";

const CONFIG_DIR = join(homedir(), ".config", "ttrak");
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
    $schema: "https://raw.githubusercontent.com/esau-morais/ttrak/main/data.schema.json",
    ...rest,
  };

  await Bun.write(DATA_PATH, JSON.stringify(output, null, 2));
}

export async function loadConfigStore(): Promise<ConfigStore> {
  try {
    await ensureConfigDir();

    if (!(await Bun.file(CONFIG_PATH).exists())) {
      const defaultConfig = ConfigStoreSchema.parse({});
      await saveConfigStore(defaultConfig);
      return defaultConfig;
    }

    const data = await Bun.file(CONFIG_PATH).json();
    const result = ConfigStoreSchema.safeParse(data);

    if (!result.success) {
      console.error("Invalid config store:", result.error);
      return ConfigStoreSchema.parse({});
    }

    const config = result.data;

    if (config.integrations?.github && !config.integrations.github.token) {
      config.integrations.github.token = process.env.GITHUB_TOKEN || "";
    }

    if (config.integrations?.linear && !config.integrations.linear.apiKey) {
      config.integrations.linear.apiKey = process.env.LINEAR_API_KEY || "";
    }

    return config;
  } catch (error) {
    return ConfigStoreSchema.parse({});
  }
}

export async function saveConfigStore(store: ConfigStore): Promise<void> {
  await ensureConfigDir();

  const { $schema, ...rest } = store;
  const output = {
    $schema: "https://raw.githubusercontent.com/esau-morais/ttrak/main/config.schema.json",
    ...rest,
  };

  await Bun.write(CONFIG_PATH, JSON.stringify(output, null, 2));
}

export function getDataPath(): string {
  return DATA_PATH;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
