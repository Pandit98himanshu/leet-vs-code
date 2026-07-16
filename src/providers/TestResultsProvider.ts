import * as vscode from "vscode";
import { TestResult } from "../submission/TestService";
import { SubmitResult } from "../submission/SubmitService";

export class TestResultsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "leetvscodeTestResultsView";
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

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

    webviewView.webview.html = this.getHtmlForWebview("Waiting for test results...");
  }

  public updateResult(result: TestResult, metadata: { title: string; questionFrontendId: string; dataInput?: string }) {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this.renderResultHtml(result, metadata));
      this._view.show?.(true);
    }
  }

  public updateSubmitResult(result: SubmitResult, metadata: { title: string; questionFrontendId: string }) {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this.renderSubmitResultHtml(result, metadata));
      this._view.show?.(true);
    }
  }

  public clear() {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview("Waiting for test results...");
    }
  }

  private renderResultHtml(result: TestResult, metadata: { title: string; questionFrontendId: string; dataInput?: string }): string {
    let content = `<h2>${metadata.questionFrontendId}. ${metadata.title}</h2>`;
    // content += JSON.stringify(result);
    content += `<p><strong>Status:</strong> ${result.statusMsg ?? result.state ?? "Tested"}</p>`;

    if (result.totalCorrect !== undefined && result.totalTestcases !== undefined) {
      const allPassed = result.correctAnswer
        ? ' style="color: green;"' : ' style="color: red;"';
      content += `<p${allPassed}>${result.totalCorrect}/${result.totalTestcases} testcases passed.</p>`;
    }

    if (result.runtime && result.memory) {
      content += `<p><strong>Runtime:</strong> ${result.runtime} | <strong>Memory:</strong> ${result.memory}</p>`;
    }

    if (result.compileError) {
      content += `<h4>Compile Error</h4><pre><code>${this.escapeHtml(result.compileError)}</code></pre>`;
    }

    if (result.runtimeError) {
      content += `<h4>Runtime Error</h4><pre><code>${this.escapeHtml(result.runtimeError)}</code></pre>`;
    }

    let inputTestcases: string[] = [];
    if (metadata.dataInput && result.totalTestcases) {
      const lines = metadata.dataInput.trim().split('\n');
      const linesPerTestcase = lines.length / result.totalTestcases;
      if (Number.isInteger(linesPerTestcase) && linesPerTestcase > 0) {
        for (let i = 0; i < result.totalTestcases; i++) {
          inputTestcases.push(lines.slice(i * linesPerTestcase, (i + 1) * linesPerTestcase).join('\n'));
        }
      }
    }

    if (result.totalTestcases && result.expectedCodeAnswer && result.codeAnswer) {
      for (let i = 0; i < result.totalTestcases; i++) {
        content += `<hr>`;
        content += `<h3>Testcase ${i + 1}</h3>`;
        content += `<hr>`;
        if (inputTestcases[i]) {
          content += `<p><strong>Input:</strong> <pre><code>${this.escapeHtml(inputTestcases[i])}</code></pre></p>`;
        }
        const outputColorStyle = result.codeAnswer[i] !== result.expectedCodeAnswer[i]
          ? ' style="color: red;"' : ' style="color: green;"';
        content += `<p><strong>Output:</strong> <pre><code${outputColorStyle}>${this.escapeHtml(result.codeAnswer[i])}</code></pre></p>`;
        content += `<p><strong>Expected:</strong> <pre><code>${this.escapeHtml(result.expectedCodeAnswer[i])}</code></pre></p>`;
      }
    }

    return content;
  }

  private renderSubmitResultHtml(result: SubmitResult, metadata: { title: string; questionFrontendId: string }): string {
    let content = `<h2>${metadata.questionFrontendId}. ${metadata.title}</h2>`;
    content += `<h3>Submission Result</h3>`;

    const isAccepted = result.statusMsg === "Accepted";
    const statusColorStyle = isAccepted ? ' style="color: green;"' : ' style="color: red;"';
    content += `<p><strong>Status:</strong> <span${statusColorStyle}>${result.statusMsg ?? result.state ?? "Submitted"}</span></p>`;

    if (result.totalCorrect !== undefined && result.totalTestcases !== undefined) {
      content += `<p>${result.totalCorrect}/${result.totalTestcases} testcases passed.</p>`;
    }

    if (result.runtime && result.memory) {
      content += `<p><strong>Runtime:</strong> ${result.runtime} | <strong>Memory:</strong> ${result.memory}</p>`;
    }

    if (result.compileError) {
      content += `<h4>Compile Error</h4><pre><code>${this.escapeHtml(result.compileError)}</code></pre>`;
    }

    if (result.runtimeError) {
      content += `<h4>Runtime Error</h4><pre><code>${this.escapeHtml(result.runtimeError)}</code></pre>`;
    }

    if (result.lastTestcase) {
      content += `<h4>Testcase Failed</h4>`;
      content += `<p><strong>Input:</strong> <pre><code>${this.escapeHtml(result.lastTestcase)}</code></pre></p>`;
      if (result.codeOutput) {
        content += `<p><strong>Output:</strong> <pre><code style="color: red;">${this.escapeHtml(result.codeOutput)}</code></pre></p>`;
      }
      if (result.expectedOutput) {
        content += `<p><strong>Expected:</strong> <pre><code>${this.escapeHtml(result.expectedOutput)}</code></pre></p>`;
      }
    }

    return content;
  }

  private getHtmlForWebview(content: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Results</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 10px;
    }
    h2, h3, h4 {
      color: var(--vscode-editor-foreground);
    }
    pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      font-family: var(--vscode-editor-font-family);
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }

  private escapeHtml(unsafe?: string) {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
