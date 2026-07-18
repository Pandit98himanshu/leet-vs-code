import * as vscode from "vscode";
import { Problem, getProblemHtml } from "../views/ProblemView";
import { escapeHtml } from "../utils/html";

export class ProblemPanel {
  private static currentPanel: ProblemPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    problem: Problem,
    dailyDate?: string
  ) {
    const column = vscode.ViewColumn.One;

    if (ProblemPanel.currentPanel) {
      ProblemPanel.currentPanel._panel.reveal(column);
      ProblemPanel.currentPanel._update(problem, dailyDate);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetcodeProblem",
      `${problem.title}`,
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ProblemPanel.currentPanel = new ProblemPanel(panel, problem, dailyDate, extensionUri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    problem: Problem,
    dailyDate?: string,
    private readonly _extensionUri?: vscode.Uri
  ) {
    this._panel = panel;
    this._update(problem, dailyDate);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message?.command === "searchProblem" && message.slug) {
          await vscode.commands.executeCommand(
            "leetvscode.searchProblem",
            String(message.slug)
          );
        }

        if (message?.command === "openSolution") {
          await vscode.commands.executeCommand(
            "leetvscode.openSolution",
            message.problem,
            Number(message.snippetIndex ?? 0)
          );
        }

        if (message?.command === "submitSolution") {
          await vscode.commands.executeCommand("leetvscode.submitSolution");
        }
      },
      null,
      this._disposables
    );
  }

  private _update(problem: Problem, dailyDate?: string) {
    this._panel.title = `${escapeHtml(problem.questionFrontendId)}. ${escapeHtml(problem.title)}`;
    this._panel.webview.html = this._getHtml(problem, dailyDate);
  }

  private _getHtml(problem: Problem, dailyDate?: string): string {
    const defaultLang = vscode.workspace
      .getConfiguration("leetvscode")
      .get<string>("defaultLanguage", "");

    let styleUri = "";
    if (this._extensionUri) {
      styleUri = this._panel.webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media", "styles.css")
      ).toString();
    }

    return getProblemHtml(problem, styleUri, dailyDate, defaultLang);
  }

  dispose() {
    ProblemPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
