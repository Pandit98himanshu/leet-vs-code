import * as vscode from "vscode";
import { SessionManager } from "../session/SessionManager";

export class ProblemItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    iconId?: string,
    public readonly description?: string
  ) {
    super(label, collapsibleState);
    this.command = command;
    if (iconId) {
      this.iconPath = new vscode.ThemeIcon(iconId);
    }
    this.description = description;
  }
}

export class ProblemsProvider
  implements vscode.TreeDataProvider<ProblemItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ProblemItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly sessionManager: SessionManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProblemItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProblemItem): Promise<ProblemItem[]> {
    if (element) {
      return [];
    }

    const hasSession = await this.sessionManager.hasSession();

    return [
      new ProblemItem(
        "Daily Challenge",
        {
          command: "leetvscode.showDailyChallenge",
          title: "Show Daily Challenge",
        },
        vscode.TreeItemCollapsibleState.None,
        "calendar",
        "Today's problem"
      ),
      new ProblemItem(
        "Browse Problems",
        {
          command: "leetvscode.browseProblems",
          title: "Browse Problems",
        },
        vscode.TreeItemCollapsibleState.None,
        "list-unordered",
        "Filter by difficulty"
      ),
      new ProblemItem(
        "Search Problem",
        {
          command: "leetvscode.searchProblem",
          title: "Search Problem",
        },
        vscode.TreeItemCollapsibleState.None,
        "search",
        "By title slug"
      ),
      new ProblemItem(
        "User Profile",
        {
          command: "leetvscode.showUserProfile",
          title: "Show User Profile",
        },
        vscode.TreeItemCollapsibleState.None,
        "person",
        "Any public user"
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
      new ProblemItem(
        hasSession ? "Clear Session" : "Set Session Cookie",
        {
          command: hasSession
            ? "leetvscode.clearSession"
            : "leetvscode.setSession",
          title: hasSession ? "Clear Session" : "Set Session",
        },
        vscode.TreeItemCollapsibleState.None,
        hasSession ? "sign-out" : "key"
      ),
    ];
  }
}