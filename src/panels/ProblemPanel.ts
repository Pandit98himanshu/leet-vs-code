import * as vscode from "vscode";

interface Problem {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  topicTags: { name: string; slug: string }[];
  hints: string[];
  likes: number;
  dislikes: number;
  isPaidOnly: boolean;
  codeSnippets?: { lang: string; langSlug: string; code: string }[];
  stats?: string;
  exampleTestcases?: string;
  similarQuestions?: string;
}

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
      `LeetCode: ${problem.title}`,
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ProblemPanel.currentPanel = new ProblemPanel(panel, problem, dailyDate);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    problem: Problem,
    dailyDate?: string
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
    this._panel.title = `LeetCode: ${problem.title}`;
    this._panel.webview.html = this._getHtml(problem, dailyDate);
  }

  private _getHtml(problem: Problem, dailyDate?: string): string {
    const difficultyColor =
      problem.difficulty === "Easy"
        ? "#00b8a3"
        : problem.difficulty === "Medium"
        ? "#ffc01e"
        : "#ff375f";

    // Parse stats JSON safely
    let acRate = "N/A";
    try {
      if (problem.stats) {
        const stats = JSON.parse(problem.stats);
        acRate = stats.acRate ?? "N/A";
      }
    } catch {
      // ignore
    }

    // Parse similar questions safely
    let similarQuestions: { title: string; titleSlug: string; difficulty: string }[] = [];
    try {
      if (problem.similarQuestions) {
        similarQuestions = JSON.parse(problem.similarQuestions);
      }
    } catch {
      // ignore
    }

    // Code snippets select options
    const snippetOptions = (problem.codeSnippets ?? [])
      .map(
        (s, i) =>
          `<option value="${i}">${escapeHtml(s.lang)}</option>`
      )
      .join("");

    const snippetsJson = escapeScriptJson(JSON.stringify(
      (problem.codeSnippets ?? []).map((s) => ({
        lang: s.lang,
        langSlug: s.langSlug,
        code: s.code,
      }))
    ));
    const problemJson = escapeScriptJson(
      JSON.stringify({
        questionId: problem.questionId,
        questionFrontendId: problem.questionFrontendId,
        title: problem.title,
        titleSlug: problem.titleSlug,
        codeSnippets: problem.codeSnippets ?? [],
      })
    );

    // Hints
    const hintsHtml = problem.hints?.length
      ? problem.hints
          .map(
            (h, i) =>
              `<details class="hint"><summary>Hint ${i + 1}</summary><p>${h}</p></details>`
          )
          .join("")
      : '<p class="muted">No hints available.</p>';

    // Similar questions
    const similarHtml = similarQuestions.length
      ? similarQuestions
          .map(
            (q) =>
              `<span class="tag" style="cursor:pointer" onclick="openProblem('${escapeHtml(q.titleSlug)}')">${escapeHtml(q.title)} <small>(${escapeHtml(q.difficulty)})</small></span>`
          )
          .join(" ")
      : '<span class="muted">None</span>';

    const dailyBadge = dailyDate
      ? `<span class="daily-badge">📅 Daily Challenge · ${dailyDate}</span>`
      : "";

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(problem.title)}</title>
  <style>
    :root {
      --radius: 8px;
      --easy: #00b8a3;
      --medium: #ffc01e;
      --hard: #ff375f;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 1em; font-weight: 600; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
    p { line-height: 1.65; }
    pre { background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-textBlockQuote-border); border-radius: var(--radius); padding: 12px 16px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
    code { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
    .badge {
      padding: 2px 10px;
      border-radius: 99px;
      font-size: 0.78em;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .difficulty { background: ${difficultyColor}22; color: ${difficultyColor}; border: 1px solid ${difficultyColor}55; }
    .daily-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .stat-badge { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.78em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin: 2px;
    }
    .tags { margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid var(--vscode-widget-border, #333); margin: 20px 0; }
    .problem-content img { max-width: 100%; }
    .problem-content ul, .problem-content ol { padding-left: 20px; }
    .problem-content li { margin: 4px 0; }
    .problem-content blockquote { border-left: 3px solid var(--vscode-textBlockQuote-border); padding-left: 12px; opacity: 0.85; margin: 8px 0; }
    .hint { background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-widget-border, #333); border-radius: var(--radius); padding: 10px 14px; margin: 8px 0; }
    .hint summary { cursor: pointer; font-weight: 500; user-select: none; }
    .hint p { margin-top: 8px; }
    .snippet-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .snippet-bar select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 0.9em;
    }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 0.85em;
      font-weight: 500;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .snippet-code { position: relative; }
    .copy-notice { font-size: 0.8em; color: var(--vscode-notificationsInfoIcon-foreground); margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .copy-notice.show { opacity: 1; }
    .muted { opacity: 0.55; font-style: italic; }
    .open-link { float: right; margin-top: -2px; }
  </style>
</head>
<body>
  <h1>
    ${escapeHtml(problem.questionFrontendId)}. ${escapeHtml(problem.title)}
    <a class="open-link" href="https://leetcode.com/problems/${escapeHtml(problem.titleSlug)}/" title="Open on LeetCode">↗ LeetCode</a>
  </h1>

  <div class="meta">
    ${dailyBadge}
    <span class="badge difficulty">${escapeHtml(problem.difficulty)}</span>
    <span class="badge stat-badge">👍 ${problem.likes.toLocaleString()}</span>
    <span class="badge stat-badge">👎 ${problem.dislikes.toLocaleString()}</span>
    <span class="badge stat-badge">✅ AC Rate: ${acRate}</span>
    ${problem.isPaidOnly ? '<span class="badge" style="background:#ffd70022;color:#ffd700;border:1px solid #ffd70055">🔒 Premium</span>' : ""}
  </div>

  <div class="tags">
    ${problem.topicTags.map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}
  </div>

  <hr class="divider" />

  <div class="problem-content">
    ${problem.content ?? "<p>Content not available.</p>"}
  </div>

  <hr class="divider" />

  <h2>Hints</h2>
  ${hintsHtml}

  <hr class="divider" />

  <h2>Code Snippets</h2>
  ${
    (problem.codeSnippets ?? []).length > 0
      ? `<div class="snippet-bar">
           <select id="langSelect" onchange="updateSnippet()">${snippetOptions}</select>
           <button class="btn btn-secondary" onclick="copySnippet()">Copy</button>
           <button class="btn" onclick="openSolution()">Open in Editor</button>
           <button class="btn btn-secondary" onclick="submitSolution()">Submit Active File</button>
           <span class="copy-notice" id="copyNotice">Copied!</span>
         </div>
         <div class="snippet-code">
           <pre><code id="snippetCode"></code></pre>
         </div>`
      : '<p class="muted">No code snippets available.</p>'
  }

  <hr class="divider" />

  <h2>Similar Questions</h2>
  <div>${similarHtml}</div>

  <script>
    const vscode = acquireVsCodeApi();
    const snippets = ${snippetsJson};
    const problem = ${problemJson};

    function updateSnippet() {
      const idx = document.getElementById('langSelect')?.value ?? '0';
      const code = snippets[parseInt(idx)]?.code ?? '';
      const el = document.getElementById('snippetCode');
      if (el) el.textContent = code;
    }

    function copySnippet() {
      const idx = document.getElementById('langSelect')?.value ?? '0';
      const code = snippets[parseInt(idx)]?.code ?? '';
      navigator.clipboard.writeText(code).then(() => {
        const n = document.getElementById('copyNotice');
        if (n) {
          n.classList.add('show');
          setTimeout(() => n.classList.remove('show'), 1800);
        }
      });
    }

    function openProblem(slug) {
      vscode.postMessage({ command: 'searchProblem', slug });
    }

    function openSolution() {
      const snippetIndex = parseInt(document.getElementById('langSelect')?.value ?? '0');
      vscode.postMessage({ command: 'openSolution', problem, snippetIndex });
    }

    function submitSolution() {
      vscode.postMessage({ command: 'submitSolution' });
    }

    // init
    updateSnippet();
  </script>
</body>
</html>`;
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

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeScriptJson(json: string): string {
  return json.replace(/</g, "\\u003c");
}
