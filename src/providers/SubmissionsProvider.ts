import * as vscode from "vscode";
import type { Submission } from "leetcode-query";
import { SessionManager } from "../session/SessionManager";

export class SubmissionItem extends vscode.TreeItem {
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

export class SubmissionsProvider
  implements vscode.TreeDataProvider<SubmissionItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    SubmissionItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly sessionManager: SessionManager) {
    // Auto-refresh when the user signs in or out
    this.sessionManager.onDidChangeSession(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SubmissionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SubmissionItem): Promise<SubmissionItem[]> {
    if (element) {
      return [];
    }

    const hasSession = await this.sessionManager.hasSession();
    if (!hasSession) {
      return [
        new SubmissionItem(
          "Set session to view submissions",
          {
            command: "leetvscode.setSession",
            title: "Set Session",
          },
          vscode.TreeItemCollapsibleState.None,
          "key"
        ),
      ];
    }

    return this.getSubmissionItems();
  }

  private async getSubmissionItems(): Promise<SubmissionItem[]> {
    let submissions: Submission[];
    try {
      const lc = await this.sessionManager.getLeetCodeClient();
      const whoami = await lc.whoami();
      if (!whoami?.username) {
        return [
          new SubmissionItem(
            "Session expired — please set a new session",
            {
              command: "leetvscode.setSession",
              title: "Set Session",
            },
            vscode.TreeItemCollapsibleState.None,
            "warning"
          ),
        ];
      }
      submissions = await lc.submissions({ limit: 20 });
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load submissions: ${String(err)}`
      );
      return [
        new SubmissionItem(
          "Failed to load submissions",
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "error"
        ),
      ];
    }

    if (!submissions.length) {
      return [
        new SubmissionItem(
          "No submissions found",
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "info"
        ),
      ];
    }

    return submissions.map((s) => {
      const icon = s.statusDisplay === "Accepted" ? "check" : "circle-large-outline";
      const label = `${s.title}`;
      const description = `${s.statusDisplay} · ${s.lang}`;
      const submittedAt = new Date(Number(s.timestamp) * 1000).toLocaleString();
      const detail = `Status: ${s.statusDisplay} · ${submittedAt}`;

      const item = new SubmissionItem(
        label,
        {
          command: "leetvscode.openSubmission",
          title: "Open Submission",
          arguments: [s.id, s.titleSlug],
        },
        vscode.TreeItemCollapsibleState.None,
        icon,
        description
      );

      item.tooltip = detail;
      return item;
    });
  }
}
