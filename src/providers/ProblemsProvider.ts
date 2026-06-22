import * as vscode from "vscode";
import type { ProblemList } from "leetcode-query";
import { SessionManager } from "../session/SessionManager";

type DifficultyFilter = "All" | "Easy" | "Medium" | "Hard";
type ProblemSummary = ProblemList["questions"][number];
type ProblemItemKind = "action" | "allProblems" | "problem";

export class ProblemItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    iconId?: string,
    public readonly description?: string,
    public readonly kind: ProblemItemKind = "action",
    public readonly difficulty?: DifficultyFilter,
    public readonly problem?: ProblemSummary
  ) {
    super(label, collapsibleState);
    this.command = command;
    if (iconId) {
      this.iconPath = new vscode.ThemeIcon(iconId);
    }
    this.description = description;
    this.contextValue = kind;
  }
}

export class ProblemsProvider
  implements vscode.TreeDataProvider<ProblemItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ProblemItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly problemCache = new Map<DifficultyFilter, ProblemSummary[]>();
  private readonly loadingProblems = new Map<DifficultyFilter, Promise<ProblemSummary[]>>();
  private expandAllProblems = false;

  constructor(private readonly sessionManager: SessionManager) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  showAllProblems(): void {
    this.expandAllProblems = true;
    this.refresh();
  }

  getTreeItem(element: ProblemItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProblemItem): Promise<ProblemItem[]> {
    if (element) {
      if (element.kind === "allProblems") {
        return this.getProblemItems("All");
      }

      return [];
    }

    const hasSession = await this.sessionManager.hasSession();

    return [
      new ProblemItem(
        "View All Problems",
        {
          command: "leetvscode.viewAllProblems",
          title: "View All Problems",
        },
        this.expandAllProblems ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
        "list-unordered",
        undefined,
        "allProblems"
      ),
      new ProblemItem(
        hasSession ? "My Submissions" : "My Submissions (login required)",
        {
          command: "leetvscode.showMySubmissions",
          title: "Show My Submissions",
        },
        vscode.TreeItemCollapsibleState.None,
        hasSession ? "pass" : "lock",
        hasSession ? "Last 20" : "Set session first"
      ),
    ];
  }

  private async getProblemItems(
    difficulty: DifficultyFilter
  ): Promise<ProblemItem[]> {
    let questions: ProblemSummary[];
    try {
      questions = await this.getProblems(difficulty);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load ${difficulty} problems: ${String(err)}`
      );
      return [
        new ProblemItem(
          "Failed to load problems",
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "error"
        ),
      ];
    }

    if (!questions.length) {
      return [
        new ProblemItem(
          "No problems found",
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "info"
        ),
      ];
    }

    return questions.map((question) => {
      const label = `${question.questionFrontendId}. ${question.title}`;
      const tags = question.topicTags.map((tag) => tag.name).join(", ");

      const item = new ProblemItem(
        label,
        {
          command: "leetvscode.searchProblem",
          title: "Open Problem",
          arguments: [question.titleSlug],
        },
        vscode.TreeItemCollapsibleState.None,
        this.getProblemStatusIcon(question.status, question.isPaidOnly),
        tags,
        "problem",
        difficulty,
        question
      );
      item.tooltip = tags ? `${label}\n${tags}` : label;
      return item;
    });
  }

  private async getProblems(
    difficulty: DifficultyFilter
  ): Promise<ProblemSummary[]> {
    const cached = this.problemCache.get(difficulty);
    if (cached) {
      return cached;
    }

    const inFlight = this.loadingProblems.get(difficulty);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = this.loadProblems(difficulty);
    this.loadingProblems.set(difficulty, loadPromise);

    try {
      const questions = await loadPromise;
      this.problemCache.set(difficulty, questions);
      return questions;
    } finally {
      this.loadingProblems.delete(difficulty);
    }
  }

  private async loadProblems(
    difficulty: DifficultyFilter
  ): Promise<ProblemSummary[]> {
    const lc = await this.sessionManager.getLeetCodeClient();
    const allQuestions: ProblemSummary[] = [];
    const limit = 50;
    let offset = 0;

    while (true) {
      const filters =
        difficulty === "All"
          ? {}
          : {
            difficulty: difficulty.toUpperCase() as "EASY" | "MEDIUM" | "HARD",
          };
      const result = await lc.problems({ limit, offset, filters });
      const questions = result?.questions ?? [];

      if (!questions.length) {
        break;
      }

      allQuestions.push(...questions);
      offset += questions.length;

      if (questions.length < limit || allQuestions.length >= result.total) {
        break;
      }
    }

    return allQuestions;
  }

  private getProblemStatusIcon(
    status: string | null | undefined,
    isPaidOnly: boolean | undefined,
  ): string | undefined {
    if (isPaidOnly && !status) {
      return "lock";
    }

    if (!status) {
      return "list-map";    // no icon for unattempted problems
    }

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "ac" || normalizedStatus === "accepted") {
      return "check";
    }

    return "target";
  }
}
