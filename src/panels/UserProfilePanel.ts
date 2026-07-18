import * as vscode from "vscode";
import { UserProfile, ContestInfo, getUserProfileHtml } from "../views/UserProfileView";

export class UserProfilePanel {
  private static currentPanel: UserProfilePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    profile: UserProfile,
    contestInfo: ContestInfo
  ) {
    const column = vscode.ViewColumn.One;

    if (UserProfilePanel.currentPanel) {
      UserProfilePanel.currentPanel._panel.reveal(column);
      UserProfilePanel.currentPanel._update(profile, contestInfo);
      return;
    }

    const username = profile.matchedUser?.username ?? "User";
    const panel = vscode.window.createWebviewPanel(
      "leetcodeProfile",
      `User @${username}`,
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    UserProfilePanel.currentPanel = new UserProfilePanel(
      panel,
      profile,
      contestInfo,
      extensionUri
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    profile: UserProfile,
    contestInfo: ContestInfo,
    private readonly _extensionUri?: vscode.Uri
  ) {
    this._panel = panel;
    this._update(profile, contestInfo);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private _update(profile: UserProfile, contestInfo: ContestInfo) {
    const username = profile.matchedUser?.username ?? "User";
    this._panel.title = `User @${username}`;
    this._panel.webview.html = this._getHtml(profile, contestInfo);
  }

  private _getHtml(profile: UserProfile, contestInfo: ContestInfo): string {
    let styleUri = "";
    if (this._extensionUri) {
      styleUri = this._panel.webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media", "styles.css")
      ).toString();
    }
    return getUserProfileHtml(profile, contestInfo, styleUri);
  }

  dispose() {
    UserProfilePanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}