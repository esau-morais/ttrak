import {
	BoxRenderable,
	type CliRenderer,
	InputRenderable,
	InputRenderableEvents,
	type KeyEvent,
	type PasteEvent,
	RenderableEvents,
	TextRenderable,
} from "@opentui/core";
import { saveConfigStore } from "../../data/store";
import type { ConfigStore } from "../../schema";
import type { Theme } from "../theme";

type IntegrationField = "github" | "linear" | "githubRepo" | null;

export class IntegrationSetup {
	private renderer: CliRenderer;
	private theme: Theme;
	private config: ConfigStore;
	private container: BoxRenderable;
	private title: TextRenderable;
	private description: TextRenderable;
	private statusText: TextRenderable;
	private githubTokenBox: BoxRenderable;
	private githubTokenLabel: TextRenderable;
	private githubTokenInput: InputRenderable;
	private githubRepoBox: BoxRenderable;
	private githubRepoLabel: TextRenderable;
	private githubRepoInput: InputRenderable;
	private linearTokenBox: BoxRenderable;
	private linearTokenLabel: TextRenderable;
	private linearTokenInput: InputRenderable;
	private footer: TextRenderable;
	private activeField: IntegrationField = null;
	private boundKeyHandler: (key: KeyEvent) => void;
	private boundPasteHandler: (event: PasteEvent) => void;
	private onComplete: () => void;
	private validating = false;

	constructor(
		renderer: CliRenderer,
		theme: Theme,
		config: ConfigStore,
		onComplete: () => void,
	) {
		this.renderer = renderer;
		this.theme = theme;
		this.config = config;
		this.onComplete = onComplete;
		this.boundKeyHandler = this.handleKeyPress.bind(this);
		this.boundPasteHandler = this.handlePaste.bind(this);

		this.container = new BoxRenderable(renderer, {
			id: "setup-container",
			width: "100%",
			height: "100%",
			flexDirection: "column",
			padding: 2,
			backgroundColor: theme.bg,
		});

		this.title = new TextRenderable(renderer, {
			id: "setup-title",
			content: " Integration Setup",
			fg: theme.accent,
			height: 1,
			marginBottom: 1,
		});

		this.description = new TextRenderable(renderer, {
			id: "setup-desc",
			content:
				"Configure GitHub and Linear integrations. Press Tab to navigate, Esc to save and exit.",
			fg: theme.muted,
			height: 1,
			marginBottom: 2,
		});

		this.statusText = new TextRenderable(renderer, {
			id: "setup-status",
			content: "",
			fg: theme.muted,
			height: 1,
			marginBottom: 1,
		});

		this.githubTokenBox = new BoxRenderable(renderer, {
			id: "github-token-box",
			width: "100%",
			height: 3,
			flexDirection: "column",
			marginBottom: 1,
		});

		this.githubTokenLabel = new TextRenderable(renderer, {
			id: "github-token-label",
			content: "GitHub Token (github.com/settings/tokens):",
			fg: theme.fg,
			height: 1,
		});

		const githubTokenValue = this.config.integrations?.github?.token || "";
		const githubRepoValue = this.config.integrations?.github?.repo || "";
		const linearTokenValue = this.config.integrations?.linear?.apiKey || "";

		this.githubTokenInput = new InputRenderable(renderer, {
			id: "github-token-input",
			width: 70,
			height: 1,
			placeholder: "ghp_...",
			backgroundColor: theme.bg,
			focusedBackgroundColor: theme.border,
			textColor: theme.fg,
			cursorColor: theme.accent,
			value: githubTokenValue,
		});

		this.githubRepoBox = new BoxRenderable(renderer, {
			id: "github-repo-box",
			width: "100%",
			height: 3,
			flexDirection: "column",
			marginBottom: 1,
		});

		this.githubRepoLabel = new TextRenderable(renderer, {
			id: "github-repo-label",
			content: "GitHub Repository (owner/repo):",
			fg: theme.fg,
			height: 1,
		});

		this.githubRepoInput = new InputRenderable(renderer, {
			id: "github-repo-input",
			width: 70,
			height: 1,
			placeholder: "owner/repo",
			backgroundColor: theme.bg,
			focusedBackgroundColor: theme.border,
			textColor: theme.fg,
			cursorColor: theme.accent,
			value: githubRepoValue,
		});

		this.linearTokenBox = new BoxRenderable(renderer, {
			id: "linear-token-box",
			width: "100%",
			height: 3,
			flexDirection: "column",
			marginBottom: 1,
		});

		this.linearTokenLabel = new TextRenderable(renderer, {
			id: "linear-token-label",
			content: "Linear API Key (linear.app/settings/api):",
			fg: theme.fg,
			height: 1,
		});

		this.linearTokenInput = new InputRenderable(renderer, {
			id: "linear-token-input",
			width: 70,
			height: 1,
			placeholder: "lin_api_...",
			backgroundColor: theme.bg,
			focusedBackgroundColor: theme.border,
			textColor: theme.fg,
			cursorColor: theme.accent,
			value: linearTokenValue,
		});

		this.footer = new TextRenderable(renderer, {
			id: "setup-footer",
			content: "tab:next  shift+tab:prev  enter:validate  esc:save&exit",
			fg: theme.muted,
			height: 1,
			marginTop: 2,
		});

		this.githubTokenBox.add(this.githubTokenLabel);
		this.githubTokenBox.add(this.githubTokenInput);
		this.githubRepoBox.add(this.githubRepoLabel);
		this.githubRepoBox.add(this.githubRepoInput);
		this.linearTokenBox.add(this.linearTokenLabel);
		this.linearTokenBox.add(this.linearTokenInput);

		this.container.add(this.title);
		this.container.add(this.description);
		this.container.add(this.statusText);
		this.container.add(this.githubTokenBox);
		this.container.add(this.githubRepoBox);
		this.container.add(this.linearTokenBox);
		this.container.add(this.footer);

		renderer.root.add(this.container);

		this.setupEvents();

		if (githubTokenValue) this.githubTokenInput.requestRender();
		if (githubRepoValue) this.githubRepoInput.requestRender();
		if (linearTokenValue) this.linearTokenInput.requestRender();

		queueMicrotask(() => {
			this.githubTokenInput.focus();
			this.activeField = "github";
		});
	}

	private setupEvents() {
		this.renderer.keyInput.on("keypress", this.boundKeyHandler);
		this.renderer.keyInput.on("paste", this.boundPasteHandler);

		this.githubTokenInput.on(InputRenderableEvents.INPUT, () => {
			this.statusText.content = "";
		});

		this.githubRepoInput.on(InputRenderableEvents.INPUT, () => {
			this.statusText.content = "";
		});

		this.linearTokenInput.on(InputRenderableEvents.INPUT, () => {
			this.statusText.content = "";
		});

		this.githubTokenInput.on(RenderableEvents.FOCUSED, () => {
			this.activeField = "github";
			this.githubTokenInput.cursorPosition = this.githubTokenInput.value.length;
		});

		this.githubRepoInput.on(RenderableEvents.FOCUSED, () => {
			this.activeField = "githubRepo";
			this.githubRepoInput.cursorPosition = this.githubRepoInput.value.length;
		});

		this.linearTokenInput.on(RenderableEvents.FOCUSED, () => {
			this.activeField = "linear";
			this.linearTokenInput.cursorPosition = this.linearTokenInput.value.length;
		});
	}

	private handleKeyPress(key: KeyEvent) {
		if (this.validating) return;

		if (key.name === "escape") {
			this.saveAndExit();
			return;
		}

		if (key.name === "tab") {
			if (key.shift) {
				this.navigatePrev();
			} else {
				this.navigateNext();
			}
			return;
		}

		if (key.name === "return") {
			this.validateActiveField();
			return;
		}

		if (key.name === "backspace" && (key.meta || key.option)) {
			const input = this.getActiveInput();
			if (input) {
				this.deleteWordBackward(input);
			}
			return;
		}
	}

	private handlePaste(event: PasteEvent) {
		const text = event.text.trim();
		const input = this.getActiveInput();
		if (input) {
			input.insertText(text);
		}
	}

	private getActiveInput(): InputRenderable | null {
		if (this.activeField === "github") return this.githubTokenInput;
		if (this.activeField === "githubRepo") return this.githubRepoInput;
		if (this.activeField === "linear") return this.linearTokenInput;
		return null;
	}

	private deleteWordBackward(input: InputRenderable) {
		const value = input.value;
		const pos = input.cursorPosition;
		if (pos === 0) return;

		let newPos = pos - 1;
		while (newPos > 0 && value[newPos - 1] === " ") newPos--;
		while (newPos > 0 && value[newPos - 1] !== " ") newPos--;

		const before = value.substring(0, newPos);
		const after = value.substring(pos);
		input.value = before + after;
		input.cursorPosition = newPos;
	}

	private navigateNext() {
		if (this.activeField === "github") {
			this.githubRepoInput.focus();
		} else if (this.activeField === "githubRepo") {
			this.linearTokenInput.focus();
		} else if (this.activeField === "linear") {
			this.githubTokenInput.focus();
		}
	}

	private navigatePrev() {
		if (this.activeField === "github") {
			this.linearTokenInput.focus();
		} else if (this.activeField === "githubRepo") {
			this.githubTokenInput.focus();
		} else if (this.activeField === "linear") {
			this.githubRepoInput.focus();
		}
	}

	private async validateActiveField() {
		if (this.validating) return;

		if (this.activeField === "github") {
			await this.validateGitHubToken();
		} else if (this.activeField === "linear") {
			await this.validateLinearToken();
		}
	}

	private async validateGitHubToken() {
		const token = this.githubTokenInput.value.trim();
		if (!token) {
			this.statusText.content = "✗ GitHub token is empty";
			this.statusText.fg = this.theme.error;
			return;
		}

		this.validating = true;
		this.statusText.content = "Validating GitHub token...";
		this.statusText.fg = this.theme.muted;
		this.githubTokenInput.textColor = this.theme.muted;
		this.githubRepoInput.textColor = this.theme.muted;
		this.linearTokenInput.textColor = this.theme.muted;

		try {
			const response = await fetch("https://api.github.com/user", {
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "ttrak-tui",
				},
			});

			if (response.ok) {
				const user = (await response.json()) as { login: string };
				this.statusText.content = `✓ GitHub token valid (${user.login})`;
				this.statusText.fg = this.theme.success;
			} else {
				this.statusText.content = "✗ GitHub token invalid";
				this.statusText.fg = this.theme.error;
			}
		} catch (_error) {
			this.statusText.content = "✗ GitHub validation failed (network error)";
			this.statusText.fg = this.theme.error;
		} finally {
			this.validating = false;
			this.githubTokenInput.textColor = this.theme.fg;
			this.githubRepoInput.textColor = this.theme.fg;
			this.linearTokenInput.textColor = this.theme.fg;
		}
	}

	private async validateLinearToken() {
		const token = this.linearTokenInput.value.trim();
		if (!token) {
			this.statusText.content = "✗ Linear token is empty";
			this.statusText.fg = this.theme.error;
			return;
		}

		this.validating = true;
		this.statusText.content = "Validating Linear token...";
		this.statusText.fg = this.theme.muted;
		this.githubTokenInput.textColor = this.theme.muted;
		this.githubRepoInput.textColor = this.theme.muted;
		this.linearTokenInput.textColor = this.theme.muted;

		try {
			const response = await fetch("https://api.linear.app/graphql", {
				method: "POST",
				headers: {
					Authorization: token,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: "{ viewer { id name } }",
				}),
			});

			if (response.ok) {
				const result = (await response.json()) as {
					data?: { viewer?: { id: string; name: string } };
				};
				if (result.data?.viewer) {
					this.statusText.content = `✓ Linear token valid (${result.data.viewer.name})`;
					this.statusText.fg = this.theme.success;
				} else {
					this.statusText.content = "✗ Linear token invalid";
					this.statusText.fg = this.theme.error;
				}
			} else {
				this.statusText.content = "✗ Linear token invalid";
				this.statusText.fg = this.theme.error;
			}
		} catch (_error) {
			this.statusText.content = "✗ Linear validation failed (network error)";
			this.statusText.fg = this.theme.error;
		} finally {
			this.validating = false;
			this.githubTokenInput.textColor = this.theme.fg;
			this.githubRepoInput.textColor = this.theme.fg;
			this.linearTokenInput.textColor = this.theme.fg;
		}
	}

	private async saveAndExit() {
		this.githubTokenInput.blur();
		this.githubRepoInput.blur();
		this.linearTokenInput.blur();

		const githubToken = this.githubTokenInput.value.trim();
		const githubRepo = this.githubRepoInput.value.trim();
		const linearToken = this.linearTokenInput.value.trim();

		if (!this.config.integrations) {
			this.config.integrations = {};
		}

		if (githubToken && githubRepo) {
			this.config.integrations.github = {
				token: githubToken,
				repo: githubRepo,
				syncInterval: 30,
			};
		} else {
			delete this.config.integrations.github;
		}

		if (linearToken) {
			this.config.integrations.linear = {
				apiKey: linearToken,
				syncInterval: 30,
				syncOnlyAssigned: true,
			};
		} else {
			delete this.config.integrations.linear;
		}

		if (this.config.integrations.github || this.config.integrations.linear) {
			if (!this.config.integrations.sync) {
				this.config.integrations.sync = { enabled: true };
			}
		} else {
			delete this.config.integrations.sync;
		}

		await saveConfigStore(this.config);
		this.destroy();
		this.onComplete();
	}

	destroy() {
		this.renderer.keyInput.off("keypress", this.boundKeyHandler);
		this.renderer.keyInput.off("paste", this.boundPasteHandler);

		this.githubTokenInput?.destroy();
		this.githubRepoInput?.destroy();
		this.linearTokenInput?.destroy();

		this.container?.destroy();
	}
}
