import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  TabSelectRenderable,
  TabSelectRenderableEvents,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";
import type { Task, DataStore } from "../../schema";
import type { Theme } from "../theme";
import { TaskItem } from "../components/TaskItem";
import { TaskModal, type TaskModalResult } from "../components/TaskModal";
import { saveDataStore } from "../../data/store";

type FilterTab = "all" | "todo" | "inProgress" | "done";

export class TaskListView {
  private renderer: CliRenderer;
  private theme: Theme;
  private container: BoxRenderable;
  private header: TextRenderable;
  private searchBar: InputRenderable;
  private tabBar: TabSelectRenderable;
  private listContainer: BoxRenderable;
  private emptyText: TextRenderable;
  private footer: TextRenderable;
  private taskItems: TaskItem[] = [];
  private selectedIndex = 0;
  private store: DataStore;
  private boundHandleKeyPress: (key: KeyEvent) => void;
  private activeFilter: FilterTab = "all";
  private searchQuery = "";
  private modal: TaskModal;
  private modalOpen = false;
  private confirmDelete = false;
  private searchMode = false;
  private onQuit: () => void;

  constructor(
    renderer: CliRenderer,
    theme: Theme,
    store: DataStore,
    onQuit: () => void,
  ) {
    this.renderer = renderer;
    this.theme = theme;
    this.store = store;
    this.onQuit = onQuit;
    this.boundHandleKeyPress = this.handleKeyPress.bind(this);

    this.container = new BoxRenderable(renderer, {
      id: "task-list-view",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: theme.bg,
    });

    this.header = new TextRenderable(renderer, {
      id: "header",
      content: this.getHeaderText(),
      fg: theme.accent,
      height: 1,
      flexShrink: 0,
      marginLeft: 1,
    });

    this.searchBar = new InputRenderable(renderer, {
      id: "search-bar",
      width: "100%",
      height: 1,
      placeholder: "Search tasks... (Press / to focus)",
      backgroundColor: theme.bg,
      focusedBackgroundColor: theme.border,
      textColor: theme.fg,
      focusedTextColor: theme.fg,
      placeholderColor: theme.muted,
      cursorColor: theme.accent,
      flexShrink: 0,
      marginLeft: 1,
      marginRight: 1,
    });

    this.tabBar = new TabSelectRenderable(renderer, {
      id: "filter-tabs",
      width: "100%",
      height: 3,
      options: [
        { name: "All", description: "", value: "all" },
        { name: "Todo", description: "", value: "todo" },
        { name: "In Progress", description: "", value: "inProgress" },
        { name: "Done", description: "", value: "done" },
      ],
      tabWidth: 14,
      backgroundColor: theme.bg,
      focusedBackgroundColor: theme.bg,
      textColor: theme.muted,
      focusedTextColor: theme.fg,
      selectedBackgroundColor: theme.bg,
      selectedTextColor: theme.accent,
      showDescription: false,
      showUnderline: true,
      showScrollArrows: false,
      flexShrink: 0,
    });

    this.listContainer = new BoxRenderable(renderer, {
      id: "list-container",
      width: "100%",
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: theme.bg,
    });

    this.emptyText = new TextRenderable(renderer, {
      id: "empty-text",
      content: "  No tasks. Press 'n' to create one.",
      fg: theme.muted,
      flexGrow: 1,
    });
    this.emptyText.visible = false;

    this.footer = new TextRenderable(renderer, {
      id: "footer",
      content:
        "/:search  j/k:nav  n:new  e:edit  d:del  space:status  1-4:filter  q:quit",
      fg: theme.muted,
      height: 1,
      flexShrink: 0,
      marginLeft: 1,
    });

    this.container.add(this.header);
    this.container.add(this.searchBar);
    this.container.add(this.tabBar);
    this.container.add(this.listContainer);
    this.container.add(this.emptyText);
    this.container.add(this.footer);

    this.modal = new TaskModal(renderer, theme);

    this.renderTasks();
    renderer.root.add(this.container);
    this.setupEventHandlers();
  }

  private getHeaderText(): string {
    const filtered = this.getFilteredTasks();
    const total = this.store.tasks.length;
    return ` TTRAK - ${filtered.length}/${total} tasks`;
  }

  private getFilteredTasks(): Task[] {
    let tasks = this.store.tasks;

    if (this.activeFilter !== "all") {
      tasks = tasks.filter((t) => t.status === this.activeFilter);
    }

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.id.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query),
      );
    }

    return tasks;
  }

  private renderTasks() {
    this.taskItems.forEach((item) => item.destroy());
    this.taskItems = [];

    const tasks = this.getFilteredTasks();

    if (tasks.length === 0) {
      this.emptyText.visible = true;
      this.listContainer.visible = false;
    } else {
      this.emptyText.visible = false;
      this.listContainer.visible = true;

      tasks.forEach((task, index) => {
        const item = new TaskItem(this.renderer, task, this.theme, index);
        this.taskItems.push(item);
        this.listContainer.add(item.getRenderable());
      });

      this.selectedIndex = Math.min(this.selectedIndex, tasks.length - 1);
      this.selectedIndex = Math.max(0, this.selectedIndex);
      this.updateSelection();
    }

    this.header.content = this.getHeaderText();
  }

  private setupEventHandlers() {
    this.renderer.keyInput.on("keypress", this.boundHandleKeyPress);

    this.tabBar.on(
      TabSelectRenderableEvents.SELECTION_CHANGED,
      (_index, option) => {
        this.activeFilter = option.value as FilterTab;
        this.selectedIndex = 0;
        this.renderTasks();
      },
    );

    this.searchBar.on("input", () => {
      this.searchQuery = this.searchBar.value;
      this.selectedIndex = 0;
      this.renderTasks();
    });
  }

  private handleKeyPress(key: KeyEvent) {
    if (this.modalOpen) return;

    if (this.searchMode) {
      if (key.name === "escape") {
        this.searchMode = false;
        this.searchBar.blur();
      }
      return;
    }

    if (this.confirmDelete) {
      if (key.name === "y") {
        this.deleteSelectedTask();
        this.confirmDelete = false;
        this.footer.content =
          "/:search  j/k:nav  n:new  e:edit  d:del  space:status  1-4:filter  q:quit";
        this.footer.fg = this.theme.muted;
      } else if (key.name === "n" || key.name === "escape") {
        this.confirmDelete = false;
        this.footer.content =
          "/:search  j/k:nav  n:new  e:edit  d:del  space:status  1-4:filter  q:quit";
        this.footer.fg = this.theme.muted;
      }
      return;
    }

    switch (key.name) {
      case "/":
        this.searchMode = true;
        queueMicrotask(() => {
          this.searchBar.focus();
        });
        break;
      case "j":
      case "down":
        this.moveSelection(1);
        break;
      case "k":
      case "up":
        this.moveSelection(-1);
        break;
      case "g":
        if (!key.shift) {
          this.selectedIndex = 0;
          this.updateSelection();
        }
        break;
      case "G":
        this.selectedIndex = Math.max(0, this.taskItems.length - 1);
        this.updateSelection();
        break;
      case "n":
        this.openCreateModal();
        break;
      case "e":
        this.openEditModal();
        break;
      case "d":
        if (this.taskItems.length > 0) {
          this.confirmDelete = true;
          this.footer.content = "Delete task? y:yes  n:no";
          this.footer.fg = this.theme.warning;
        }
        break;
      case "space":
        this.cycleTaskStatus();
        break;
      case "1":
        this.setFilter(0);
        break;
      case "2":
        this.setFilter(1);
        break;
      case "3":
        this.setFilter(2);
        break;
      case "4":
        this.setFilter(3);
        break;
      case "q":
        this.destroy();
        this.onQuit();
        break;
    }
  }

  private setFilter(index: number) {
    this.tabBar.setSelectedIndex(index);
    const filters: FilterTab[] = ["all", "todo", "inProgress", "done"];
    this.activeFilter = filters[index] ?? "all";
    this.selectedIndex = 0;
    this.renderTasks();
  }

  private moveSelection(delta: number) {
    if (this.taskItems.length === 0) return;
    this.selectedIndex = Math.max(
      0,
      Math.min(this.taskItems.length - 1, this.selectedIndex + delta),
    );
    this.updateSelection();
  }

  private updateSelection() {
    this.taskItems.forEach((item, index) => {
      item.setSelected(index === this.selectedIndex);
    });
  }

  private async openCreateModal() {
    this.modalOpen = true;
    const result = await this.modal.show("create");
    this.modalOpen = false;

    if (result) {
      this.createTask(result);
    }
  }

  private async openEditModal() {
    const taskItem = this.taskItems[this.selectedIndex];
    if (!taskItem) return;

    const task = taskItem.getTask();
    this.modalOpen = true;
    const result = await this.modal.show("edit", task);
    this.modalOpen = false;

    if (result) {
      this.updateTask(task.id, result);
    }
  }

  private createTask(data: TaskModalResult) {
    const now = new Date().toISOString();
    const maxId = this.store.tasks
      .filter((t) => t.id.startsWith("LOCAL-"))
      .map((t) => parseInt(t.id.replace("LOCAL-", ""), 10))
      .reduce((max, n) => Math.max(max, n), 0);

    const newTask: Task = {
      id: `LOCAL-${maxId + 1}`,
      title: data.title,
      status: data.status,
      priority: data.priority,
      createdAt: now,
      updatedAt: now,
    };

    this.store.tasks.unshift(newTask);
    this.saveAndRender();
  }

  private updateTask(id: string, data: TaskModalResult) {
    const task = this.store.tasks.find((t) => t.id === id);
    if (!task) return;

    task.title = data.title;
    task.priority = data.priority;
    task.status = data.status;
    task.updatedAt = new Date().toISOString();
    this.saveAndRender();
  }

  private deleteSelectedTask() {
    const taskItem = this.taskItems[this.selectedIndex];
    if (!taskItem) return;

    const task = taskItem.getTask();
    const index = this.store.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      this.store.tasks.splice(index, 1);
      this.saveAndRender();
    }
  }

  private cycleTaskStatus() {
    const taskItem = this.taskItems[this.selectedIndex];
    if (!taskItem) return;

    const task = taskItem.getTask();
    const storeTask = this.store.tasks.find((t) => t.id === task.id);
    if (!storeTask) return;

    const statusOrder: Task["status"][] = ["todo", "inProgress", "done"];
    const currentIndex = statusOrder.indexOf(storeTask.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    if (nextStatus) {
      storeTask.status = nextStatus;
      storeTask.updatedAt = new Date().toISOString();
      this.saveAndRender();
    }
  }

  private async saveAndRender() {
    await saveDataStore(this.store);
    this.renderTasks();
    this.footer.fg = this.theme.muted;
  }

  destroy() {
    this.renderer.keyInput.off("keypress", this.boundHandleKeyPress);
    this.taskItems.forEach((item) => item.destroy());
    this.modal.destroy();
    this.container.destroy();
  }
}
