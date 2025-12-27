import { z } from "zod";

export const TaskSchema = z.object({
	id: z.string().regex(/^(LOCAL|[A-Z]+)-\d+$/),
	title: z.string().min(1).max(200),
	description: z.string().optional(),
	status: z.enum(["todo", "inProgress", "done", "cancelled"]),
	priority: z.enum(["none", "low", "medium", "high", "urgent"]),
	createdAt: z.string(),
	updatedAt: z.string(),
	source: z.enum(["local", "github", "linear"]).default("local"),
	externalId: z.string().optional(),
	linear: z
		.object({
			id: z.string(),
			url: z.string(),
			teamId: z.string().optional(),
			externalStatus: z.string().optional(),
			syncedAt: z.string(),
		})
		.optional(),
	github: z
		.object({
			type: z.enum(["issue", "pr"]),
			number: z.number(),
			repo: z.string(),
			url: z.string(),
			externalStatus: z.string().optional(),
			syncedAt: z.string(),
		})
		.optional(),
	tags: z.array(z.string()).optional(),
	dueDate: z.string().optional(),
});

export const ThemeConfigSchema = z.object({
	mode: z.enum(["auto", "catppuccin", "system"]).default("auto"),
	flavor: z.enum(["latte", "frappe", "macchiato", "mocha"]).default("mocha"),
	overrides: z.record(z.string(), z.string()).optional(),
});

export const DataStoreSchema = z.object({
	$schema: z.string().default("./data.schema.json"),
	version: z.number().default(1),
	tasks: z.array(TaskSchema).default([]),
});

export const ConfigStoreSchema = z.object({
	$schema: z.string().default("./config.schema.json"),
	version: z.number().default(1),
	integrations: z
		.object({
			github: z
				.object({
					token: z.string(),
					repo: z.string(),
					syncInterval: z.number().default(30),
				})
				.optional(),
			linear: z
				.object({
					apiKey: z.string(),
					teamId: z.string().optional(),
					syncInterval: z.number().default(30),
					syncOnlyAssigned: z.boolean().default(true),
				})
				.optional(),
			sync: z
				.object({
					enabled: z.boolean().default(false),
					lastSync: z.record(z.string(), z.string()).optional(),
				})
				.optional(),
		})
		.optional(),
	linear: z
		.object({
			apiKey: z.string(),
			teamId: z.string().optional(),
		})
		.optional(),
	github: z
		.object({
			token: z.string(),
			repo: z.string().optional(),
		})
		.optional(),
	theme: ThemeConfigSchema.default({ mode: "auto", flavor: "mocha" }),
	defaultView: z.enum(["all", "todo", "inProgress", "done"]).default("all"),
});

export type Task = z.infer<typeof TaskSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type DataStore = z.infer<typeof DataStoreSchema>;
export type ConfigStore = z.infer<typeof ConfigStoreSchema>;
