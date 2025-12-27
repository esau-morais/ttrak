import {
	BoxRenderable,
	type CliRenderer,
	InputRenderable,
	type KeyEvent,
	TabSelectRenderable,
	TextRenderable,
} from "@opentui/core";
import type { Task } from "../../schema";
import type { Theme } from "../theme";

type ModalMode = "create" | "edit";

export interface TaskModalResult {
	title: string;
	priority: Task["priority"];
	status: Task["status"];
}

export class TaskModal {
	private renderer: CliRenderer;
	private theme: Theme;
	private overlay: BoxRenderable;
	private modal: BoxRenderable;
	private titleInput: InputRenderable;
	private prioritySelect: TabSelectRenderable;
	private statusSelect: TabSelectRenderable;
	private boundKeyHandler: (key: KeyEvent) => void;
	private onSubmit: ((result: TaskModalResult) => void) | null = null;
	private onCancel: (() => void) | null = null;
	private focusIndex = 0;
	private mode: ModalMode;
	private initialTask?: Task;

	constructor(renderer: CliRenderer, theme: Theme) {
		this.renderer = renderer;
		this.theme = theme;
		this.mode = "create";
		this.boundKeyHandler = this.handleKeyPress.bind(this);

		const termWidth = renderer.terminalWidth;
		const termHeight = renderer.terminalHeight;
		const modalWidth = 50;
		const modalHeight = 14;
		const modalLeft = Math.floor((termWidth - modalWidth) / 2);
		const modalTop = Math.floor((termHeight - modalHeight) / 2);

		this.overlay = new BoxRenderable(renderer, {
			id: "modal-overlay",
			position: "absolute",
			left: 0,
			top: 0,
			width: termWidth,
			height: termHeight,
			backgroundColor: "#00000088",
			zIndex: 100,
		});

		this.modal = new BoxRenderable(renderer, {
			id: "task-modal",
			position: "absolute",
			left: modalLeft,
			top: modalTop,
			width: modalWidth,
			height: modalHeight,
			backgroundColor: theme.bg,
			borderStyle: "single",
			borderColor: theme.accent,
			border: true,
			flexDirection: "column",
			zIndex: 101,
		});

		const titleLabel = new TextRenderable(renderer, {
			id: "modal-title-label",
			content: "Title:",
			fg: theme.fg,
			height: 1,
			marginLeft: 1,
			marginTop: 1,
		});

		this.titleInput = new InputRenderable(renderer, {
			id: "modal-title-input",
			width: modalWidth - 4,
			height: 1,
			placeholder: "Enter task title...",
			backgroundColor: theme.border,
			focusedBackgroundColor: theme.selectedBg,
			textColor: theme.fg,
			focusedTextColor: theme.selectedFg,
			placeholderColor: theme.muted,
			cursorColor: theme.accent,
			marginLeft: 1,
			marginTop: 1,
		});

		const priorityLabel = new TextRenderable(renderer, {
			id: "modal-priority-label",
			content: "Priority:",
			fg: theme.fg,
			height: 1,
			marginLeft: 1,
			marginTop: 1,
		});

		this.prioritySelect = new TabSelectRenderable(renderer, {
			id: "modal-priority-select",
			width: modalWidth - 4,
			height: 3,
			options: [
				{ name: "None", description: "", value: "none" },
				{ name: "Low", description: "", value: "low" },
				{ name: "Med", description: "", value: "medium" },
				{ name: "High", description: "", value: "high" },
				{ name: "Urgent", description: "", value: "urgent" },
			],
			tabWidth: 8,
			showDescription: false,
			backgroundColor: theme.bg,
			focusedBackgroundColor: theme.bg,
			textColor: theme.muted,
			focusedTextColor: theme.fg,
			selectedBackgroundColor: theme.bg,
			selectedTextColor: theme.accent,
			showUnderline: true,
			showScrollArrows: false,
			marginLeft: 1,
		});

		const statusLabel = new TextRenderable(renderer, {
			id: "modal-status-label",
			content: "Status:",
			fg: theme.fg,
			height: 1,
			marginLeft: 1,
			marginTop: 1,
		});

		this.statusSelect = new TabSelectRenderable(renderer, {
			id: "modal-status-select",
			width: modalWidth - 4,
			height: 3,
			options: [
				{ name: "Todo", description: "", value: "todo" },
				{ name: "In Progress", description: "", value: "inProgress" },
				{ name: "Done", description: "", value: "done" },
				{ name: "Cancelled", description: "", value: "cancelled" },
			],
			tabWidth: 10,
			showDescription: false,
			backgroundColor: theme.bg,
			focusedBackgroundColor: theme.bg,
			textColor: theme.muted,
			focusedTextColor: theme.fg,
			selectedBackgroundColor: theme.bg,
			selectedTextColor: theme.accent,
			showUnderline: true,
			showScrollArrows: false,
			marginLeft: 1,
		});

		const footer = new TextRenderable(renderer, {
			id: "modal-footer",
			content: "Tab:switch fields  Enter:save  Esc:cancel",
			fg: theme.muted,
			height: 1,
			marginLeft: 1,
			marginTop: 1,
		});

		this.modal.add(titleLabel);
		this.modal.add(this.titleInput);
		this.modal.add(priorityLabel);
		this.modal.add(this.prioritySelect);
		this.modal.add(statusLabel);
		this.modal.add(this.statusSelect);
		this.modal.add(footer);

		this.overlay.visible = false;
		this.modal.visible = false;

		renderer.root.add(this.overlay);
		renderer.root.add(this.modal);
	}

	show(mode: ModalMode, task?: Task): Promise<TaskModalResult | null> {
		return new Promise((resolve) => {
			this.mode = mode;
			this.initialTask = task;

			if (task) {
				this.titleInput.value = task.title;
				const priorityIndex = [
					"none",
					"low",
					"medium",
					"high",
					"urgent",
				].indexOf(task.priority);
				if (priorityIndex >= 0) {
					this.prioritySelect.setSelectedIndex(priorityIndex);
				}
				const statusIndex = ["todo", "inProgress", "done", "cancelled"].indexOf(
					task.status,
				);
				if (statusIndex >= 0) {
					this.statusSelect.setSelectedIndex(statusIndex);
				}
				this.titleInput.cursorPosition = task.title.length;
			} else {
				this.titleInput.value = "";
				this.prioritySelect.setSelectedIndex(0);
				this.statusSelect.setSelectedIndex(0);
				this.titleInput.cursorPosition = 0;
			}

			this.overlay.visible = true;
			this.modal.visible = true;
			this.focusIndex = 0;

			queueMicrotask(() => {
				this.updateFocus();
				this.renderer.keyInput.on("keypress", this.boundKeyHandler);
			});

			this.onSubmit = (result) => {
				this.hide();
				resolve(result);
			};

			this.onCancel = () => {
				this.hide();
				resolve(null);
			};
		});
	}

	private hide() {
		this.renderer.keyInput.off("keypress", this.boundKeyHandler);
		this.overlay.visible = false;
		this.modal.visible = false;
		this.titleInput.blur();
		this.prioritySelect.blur();
		this.statusSelect.blur();
	}

	private updateFocus() {
		if (this.focusIndex === 0) {
			this.titleInput.focus();
			this.prioritySelect.blur();
			this.statusSelect.blur();
		} else if (this.focusIndex === 1) {
			this.titleInput.blur();
			this.prioritySelect.focus();
			this.statusSelect.blur();
		} else {
			this.titleInput.blur();
			this.prioritySelect.blur();
			this.statusSelect.focus();
		}
	}

	private handleKeyPress(key: KeyEvent) {
		if (key.name === "escape") {
			this.onCancel?.();
			return;
		}

		if (key.name === "tab") {
			this.focusIndex = (this.focusIndex + 1) % 3;
			this.updateFocus();
			return;
		}

		if (key.name === "return" || key.name === "enter") {
			const title = this.titleInput.value.trim();
			if (!title) return;

			const priorityOption = this.prioritySelect.getSelectedOption();
			const priority = (priorityOption?.value as Task["priority"]) || "none";

			const statusOption = this.statusSelect.getSelectedOption();
			const status = (statusOption?.value as Task["status"]) || "todo";

			this.onSubmit?.({ title, priority, status });
		}
	}

	destroy() {
		this.renderer.keyInput.off("keypress", this.boundKeyHandler);
		this.overlay.destroy();
		this.modal.destroy();
	}
}
