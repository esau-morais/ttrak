import { DataStoreSchema, ConfigStoreSchema } from "../src/schema";

const dataJsonSchema = DataStoreSchema.toJSONSchema();
const configJsonSchema = ConfigStoreSchema.toJSONSchema();
Bun.write("data.schema.json", JSON.stringify(dataJsonSchema, null, 2));

Bun.write("config.schema.json", JSON.stringify(configJsonSchema, null, 2));

console.log("✓ Generated data.schema.json");
console.log("✓ Generated config.schema.json");
