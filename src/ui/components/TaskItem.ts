import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";
import type { Task } from "../../schema";
import type { Theme } from "../theme";

function adjustColorForSelection(color: string): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  const factor = 1.5;
  const newR = Math.min(255, Math.floor(r * factor));
  const newG = Math.min(255, Math.floor(g * factor));
  const newB = Math.min(255, Math.floor(b * factor));

  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

export class TaskItem {
  private container: BoxRenderable;
  private statusIcon: TextRenderable;
  private idText: TextRenderable;
  private titleText: TextRenderable;
  private metaText: TextRenderable;
  private task: Task;
  private theme: Theme;

  constructor(renderer: CliRenderer, task: Task, theme: Theme, index: number) {
    this.task = task;
    this.theme = theme;

    this.container = new BoxRenderable(renderer, {
      id: `task-${index}`,
      height: 1,
      flexDirection: "row",
      backgroundColor: "transparent",
    });

    const icon =
      task.status === "done"
        ? "✓"
        : task.status === "inProgress"
          ? "▶"
          : task.status === "cancelled"
            ? "✗"
            : "○";
    const iconColor =
      task.status === "done"
        ? theme.success
        : task.status === "inProgress"
          ? theme.warning
          : task.status === "cancelled"
            ? theme.error
            : theme.fg;
    this.statusIcon = new TextRenderable(renderer, {
      id: `status-${index}`,
      content: icon,
      fg: iconColor,
      width: 2,
    });

    this.idText = new TextRenderable(renderer, {
      id: `id-${index}`,
      content: task.id.padEnd(10),
      fg: theme.muted,
      width: 10,
    });

    this.titleText = new TextRenderable(renderer, {
      id: `title-${index}`,
      content: task.title,
      fg: theme.fg,
      flexGrow: 1,
    });

    const priorityLabel =
      task.priority === "none"
        ? ""
        : `[${task.priority.toUpperCase().slice(0, 3)}]`;
    const priorityColor =
      task.priority === "urgent"
        ? theme.error
        : task.priority === "high"
          ? theme.warning
          : task.priority === "medium"
            ? theme.accent
            : task.priority === "low"
              ? theme.muted
              : theme.muted;
    const source = task.linear ? "L" : task.github ? "G" : "";
    this.metaText = new TextRenderable(renderer, {
      id: `meta-${index}`,
      content: `${priorityLabel} ${source}`.trim(),
      fg: priorityColor,
      width: 10,
    });

    this.container.add(this.statusIcon);
    this.container.add(this.idText);
    this.container.add(this.titleText);
    this.container.add(this.metaText);
  }

  setSelected(selected: boolean) {
    const statusColor =
      this.task.status === "done"
        ? this.theme.success
        : this.task.status === "inProgress"
          ? this.theme.warning
          : this.task.status === "cancelled"
            ? this.theme.error
            : this.theme.fg;

    const priorityColor =
      this.task.priority === "urgent"
        ? this.theme.error
        : this.task.priority === "high"
          ? this.theme.warning
          : this.task.priority === "medium"
            ? this.theme.accent
            : this.theme.muted;

    if (selected) {
      this.container.backgroundColor = this.theme.selectedBg;
      this.titleText.fg = this.theme.selectedFg;
      this.idText.fg = this.theme.selectedFg;
      this.statusIcon.fg = this.theme.selectedFg;
      this.metaText.fg = this.theme.selectedFg;
    } else {
      this.container.backgroundColor = "transparent";
      this.titleText.fg = this.theme.fg;
      this.idText.fg = this.theme.muted;
      this.statusIcon.fg = statusColor;
      this.metaText.fg = priorityColor;
    }
  }

  getRenderable(): BoxRenderable {
    return this.container;
  }

  getTask(): Task {
    return this.task;
  }

  destroy() {
    this.container.destroy();
  }
}
