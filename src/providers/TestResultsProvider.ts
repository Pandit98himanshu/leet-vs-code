import * as vscode from "vscode";
import { TestResult } from "../submission/TestService";
import { SubmitResult } from "../submission/SubmitService";
import { getTestResultHtml, getSubmitResultHtml, getLoadingHtml } from "../views/TestResultsView";

export class TestResultsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "leetvscodeTestResultsView";
  private _view?: vscode.WebviewView;
  private _lastHtml?: string;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  private getStyleUri(): string {
    if (!this._view) return "";
    return this._view.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "styles.css")
    ).toString();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._lastHtml ?? getLoadingHtml("Waiting for test results...", this.getStyleUri());
  }

  public updateResult(result: TestResult, metadata: { title: string; questionFrontendId: string; dataInput?: string }) {
    this._lastHtml = getTestResultHtml(result, metadata, this.getStyleUri());
    if (this._view) {
      this._view.webview.html = this._lastHtml;
      this._view.show?.(true);
    } else {
      vscode.commands.executeCommand(`${TestResultsProvider.viewType}.focus`);
    }
  }

  public updateSubmitResult(result: SubmitResult, metadata: { title: string; questionFrontendId: string }) {
    this._lastHtml = getSubmitResultHtml(result, metadata, this.getStyleUri());
    if (this._view) {
      this._view.webview.html = this._lastHtml;
      this._view.show?.(true);
    } else {
      vscode.commands.executeCommand(`${TestResultsProvider.viewType}.focus`);
    }
  }

  public clear() {
    this._lastHtml = undefined;
    if (this._view) {
      this._view.webview.html = getLoadingHtml("Waiting for test results...", this.getStyleUri());
    }
  }
}
