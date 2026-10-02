import { escapeHtml } from "../utils/html";
const TurndownService = require("turndown");

export interface Problem {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  likes: number;
  dislikes: number;
  isLiked?: boolean | null;
  isPaidOnly: boolean;
  exampleTestcases?: string;
  similarQuestions?: string;
  topicTags: { name: string; slug: string }[];
  codeSnippets?: { lang: string; langSlug: string; code: string }[];
  stats?: string;
  hints: string[];
  solution?: any;
  status?: any;
  note: string | null;
  companyTags?: string[];
  premiumSolution?: { title: string; link: string; content?: string };
}

function buildMarkdown(problem: Problem, dailyDate?: string): string {
  const turndown = new TurndownService({ codeBlockStyle: 'fenced' });
  turndown.escape = function (str: string) { return str; };
  turndown.addRule('pre', {
    filter: 'pre',
    replacement: function (content: string) {
      return '\n```\n' + content.trim() + '\n```\n';
    }
  });

  let acRate = "N/A";
  let totalAccepted = "N/A";
  let totalSubmission = "N/A";

  if (problem.stats) {
    try {
      const stats = JSON.parse(problem.stats);
      acRate = stats.acRate ?? "N/A";
      totalAccepted = stats.totalAccepted ?? "N/A";
      totalSubmission = stats.totalSubmission ?? "N/A";
    } catch (e) { }
  }

  let md = `# ${problem.questionFrontendId}. ${problem.title}\n\n`;
  if (dailyDate) {
    md += `**Daily Date:** ${dailyDate}\n\n`;
  }
  md += `**Difficulty:** ${problem.difficulty}\n`;
  md += `**Likes:** ${problem.likes} | **Dislikes:** ${problem.dislikes}\n`;
  md += `**Accepted:** ${totalAccepted} / ${totalSubmission} (${acRate})\n`;
  if (problem.isPaidOnly) {
    md += `**Status:** 🔒 Premium\n`;
  }

  md += `\n---\n\n`;
  md += turndown.turndown(problem.content ?? "Content not available.");

  if (problem.hints && problem.hints.length > 0) {
    md += `\n\n---\n\n## Hints\n`;
    problem.hints.forEach((hint: string, i: number) => {
      md += `<details><summary>Hint ${i + 1}</summary>\n`;
      md += turndown.turndown(hint) + '\n</details>\n';
    });
  }

  if (problem.topicTags && problem.topicTags.length > 0) {
    md += `\n\n---\n\n## Topics\n`;
    md += problem.topicTags.map((t: any) => `\`${t.name}\``).join(' ');
  }

  let similarQuestions: any[] = [];
  if (problem.similarQuestions) {
    try {
      similarQuestions = JSON.parse(problem.similarQuestions);
    } catch (e) { }
  }
  if (similarQuestions.length > 0) {
    md += `\n\n---\n\n## Similar Questions\n`;
    similarQuestions.forEach(q => {
      md += `- ${q.title} (${q.difficulty})\n`;
    });
  }

  if (problem.companyTags && problem.companyTags.length > 0) {
    md += `\n\n---\n\n## Companies\n`;
    md += problem.companyTags.map((t: string) => `\`${t}\``).join(' ');
  }

  if (problem.note) {
    md += `\n\n---\n\n## Note\n`;
    md += turndown.turndown(problem.note);
  }

  return md;
}

export function getProblemHtml(
  problem: Problem,
  styleUri: string,
  dailyDate?: string,
  defaultLang: string = ""
): string {
  const markdownText = buildMarkdown(problem, dailyDate);
  const snippets = problem.codeSnippets ?? [];
  const defaultIndex = defaultLang
    ? snippets.findIndex((s) => s.langSlug === defaultLang)
    : -1;
  const snippetOptions = snippets
    .map(
      (s, i) =>
        `<option value="${i}"${i === defaultIndex ? " selected" : ""}>${escapeHtml(s.lang)}</option>`
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

  let displayHtml = escapeHtml(markdownText);
  displayHtml = displayHtml.replace(/&lt;details&gt;/g, '<details>');
  displayHtml = displayHtml.replace(/&lt;\/details&gt;/g, '</details>');
  displayHtml = displayHtml.replace(/&lt;summary&gt;/g, '<summary style="cursor: pointer; font-weight: bold;">');
  displayHtml = displayHtml.replace(/&lt;\/summary&gt;/g, '</summary>');

  const titleText = escapeHtml(`# ${problem.questionFrontendId}. ${problem.title}`);
  const leetcodeUrl = `https://leetcode.com/problems/${problem.titleSlug}/`;
  displayHtml = displayHtml.replace(titleText, `<a href="${leetcodeUrl}" target="_blank">${titleText}</a>`);

  let similarQuestions: any[] = [];
  if (problem.similarQuestions) {
    try {
      similarQuestions = JSON.parse(problem.similarQuestions);
    } catch (e) { }
  }
  if (similarQuestions.length > 0) {
    similarQuestions.forEach(q => {
      const qText = escapeHtml(`- ${q.title} (${q.difficulty})`);
      const qUrl = `https://leetcode.com/problems/${q.titleSlug}/`;
      displayHtml = displayHtml.replace(
        qText,
        `- <a href="javascript:void(0);" onclick="openProblem('${escapeHtml(q.titleSlug)}')">${escapeHtml(q.title)}</a> (${escapeHtml(q.difficulty)})`
      );
    });
  }

  displayHtml = displayHtml.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    const parts = src.split(' ');
    const url = parts[0];
    return `<img src="${url}" alt="${alt}" style="max-width: 25%; margin: 16px 0; display: block; border-radius: 4px;" />`;
  });

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(problem.title)}</title>
  <link rel="stylesheet" href="${styleUri}" />
  <style>
    .markdown-source {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      white-space: pre-wrap;
      word-wrap: break-word;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 16px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      line-height: 1.5;
    }
  </style>
</head>
<body class="vscode-body">
  <div class="snippet-bar" style="margin-bottom: 16px;">
    ${snippets.length > 0 ? `
    <select id="langSelect">${snippetOptions}</select>
    <button class="btn btn-secondary" onclick="copySnippet()">Copy</button>
    <button class="btn" onclick="openSolution()">Open in Editor</button>
    <button class="btn btn-secondary" onclick="submitSolution()">Submit Active File</button>
    <span class="copy-notice" id="copyNotice">Copied!</span>
    ` : ''}
  </div>

  <div class="markdown-source" id="md-source">${displayHtml}</div>

  <script>
    const vscode = acquireVsCodeApi();
    const snippets = ${snippetsJson};
    const problem = ${problemJson};

    function openProblem(slug) {
      vscode.postMessage({ command: 'searchProblem', slug });
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

    function openSolution() {
      const snippetIndex = parseInt(document.getElementById('langSelect')?.value ?? '0');
      vscode.postMessage({ command: 'openSolution', problem, snippetIndex });
    }

    function submitSolution() {
      vscode.postMessage({ command: 'submitSolution' });
    }
  </script>
</body>
</html>`;
}

export function escapeScriptJson(json: string): string {
  return json.replace(/</g, "\\\\u003c");
}
