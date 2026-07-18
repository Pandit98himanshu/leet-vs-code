import * as vscode from "vscode";
import { TestResult } from "../submission/TestService";
import { SubmitResult } from "../submission/SubmitService";
import { getTestResultHtml, getSubmitResultHtml, getLoadingHtml } from "../views/TestResultsView";

export class TestResultsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "leetvscodeTestResultsView";
  private _view?: vscode.WebviewView;
  private _lastState?: {
    type: "test" | "submit" | "loading";
    result?: any;
    metadata?: any;
    message?: string;
  };

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

    if (this._lastState) {
      if (this._lastState.type === "test") {
        webviewView.webview.html = getTestResultHtml(this._lastState.result, this._lastState.metadata, this.getStyleUri());
      } else if (this._lastState.type === "submit") {
        webviewView.webview.html = getSubmitResultHtml(this._lastState.result, this._lastState.metadata, this.getStyleUri());
      } else {
        webviewView.webview.html = getLoadingHtml(this._lastState.message ?? "Waiting for test results...", this.getStyleUri());
      }
    } else {
      webviewView.webview.html = getLoadingHtml("Waiting for test results...", this.getStyleUri());
    }
  }

  public updateResult(result: TestResult, metadata: { title: string; questionFrontendId: string; dataInput?: string }) {
    this._lastState = { type: "test", result, metadata };
    if (this._view) {
      this._view.webview.html = getTestResultHtml(result, metadata, this.getStyleUri());
      this._view.show?.(true);
    } else {
      vscode.commands.executeCommand(`${TestResultsProvider.viewType}.focus`);
    }
  }

  public updateSubmitResult(result: SubmitResult, metadata: { title: string; questionFrontendId: string }) {
    this._lastState = { type: "submit", result, metadata };
    if (this._view) {
      this._view.webview.html = getSubmitResultHtml(result, metadata, this.getStyleUri());
      this._view.show?.(true);
    } else {
      vscode.commands.executeCommand(`${TestResultsProvider.viewType}.focus`);
    }
  }

  public clear() {
    this._lastState = { type: "loading", message: "Waiting for test results..." };
    if (this._view) {
      this._view.webview.html = getLoadingHtml("Waiting for test results...", this.getStyleUri());
    }
  }
}
