import { escapeHtml } from "../utils/html";

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
}

export function getProblemHtml(
  problem: Problem,
  styleUri: string,
  dailyDate?: string,
  defaultLang: string = ""
): string {
  const difficultyColor =
    problem.difficulty === "Easy"
      ? "#00b8a3"
      : problem.difficulty === "Medium"
        ? "#ffc01e"
        : "#ff375f";

  const statusColor =
    problem.status === "ac"
      ? "#00b8a3"
      : problem.status === "notac"
        ? "#ffc01e"
        : "#ff375f";

  // Parse stats JSON safely
  let acRate = "N/A";
  let totalAccepted = "N/A";
  let totalSubmission = "N/A";

  if (problem.stats) {
    const stats = JSON.parse(problem.stats);
    acRate = stats.acRate ?? "N/A";
    totalAccepted = stats.totalAccepted ?? "N/A";
    totalSubmission = stats.totalSubmission ?? "N/A";
  }

  // Parse similar questions safely
  let similarQuestions: { title: string; titleSlug: string; difficulty: string }[] = [];
  if (problem.similarQuestions) {
    similarQuestions = JSON.parse(problem.similarQuestions);
  }

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
          `<span class="tag similar-tag" style="cursor:pointer; color: var(--${q.difficulty.toLowerCase()}); border-color: var(--${q.difficulty.toLowerCase()});" onclick="openProblem('${escapeHtml(q.titleSlug)}')">${escapeHtml(q.title)}</span>`
      )
      .join(" ")
    : '<span class="muted">None</span>';
  let statusText = "";
  if (problem.status === "ac") {
    statusText = "Solved";
  } else if (problem.status === "notac") {
    statusText = "Attempted";
  }

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(problem.title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="${styleUri}" />
  <style>
    /* Specific styles for Problem Panel */
    .difficulty { background: ${problem.difficulty === "Easy"
      ? "#00b8a3"
      : problem.difficulty === "Medium"
        ? "#ffc01e"
        : "#ff375f"
    }22; color: ${problem.difficulty === "Easy"
      ? "#00b8a3"
      : problem.difficulty === "Medium"
        ? "#ffc01e"
        : "#ff375f"
    }; border: 1px solid ${problem.difficulty === "Easy"
      ? "#00b8a3"
      : problem.difficulty === "Medium"
        ? "#ffc01e"
        : "#ff375f"
    }55; }
    .easy-text { color: var(--easy); border-color: var(--easy); }
    .medium-text { color: var(--medium); border-color: var(--medium); }
    .hard-text { color: var(--hard); border-color: var(--hard); }
  </style>
</head>
<body>
  <h1 style="display: flex; align-items: center; justify-content: space-between;">
    <span>
      ${escapeHtml(problem.questionFrontendId)}. ${escapeHtml(problem.title)}
      <a class="open-link" href="https://leetcode.com/problems/${escapeHtml(problem.titleSlug)}/" title="Open on LeetCode">↗</a>
    </span>
    ${dailyDate
      ? `<span class="badge stat-badge" style="font-size: 0.6em;"><i class="fa-regular fa-calendar-alt"></i> ${escapeHtml(
        dailyDate
      )}</span>`
      : ""
    }
    ${statusText ? `<span class="badge" style="font-size: 0.55em; color:${statusColor}">${statusText}</span>` : ""}
  </h1>
  
  <div class="meta">
    <span class="badge difficulty">${escapeHtml(problem.difficulty)}</span>
    <span class="badge stat-badge"><i class="${problem.isLiked ? `fa-solid` : `fa-regular`} fa-thumbs-up" style="color: rgb(255, 255, 255);"></i> ${problem.likes.toLocaleString()}</span>
    <span class="badge stat-badge"><i class="fa-regular fa-thumbs-down" style="color: rgb(255, 255, 255);"></i> ${problem.dislikes.toLocaleString()}</span>
    <span class="badge stat-badge">Accepted: <strong>${totalAccepted}</strong>/${totalSubmission}</span>
    <span class="badge stat-badge">Acceptance Rate: ${acRate}</span>
    ${problem.isPaidOnly ? '<span class="badge" style="background:#ffd70022;color:#ffd700;border:1px solid #ffd70055">🔒 Premium</span>' : ""}
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
  ${(problem.codeSnippets ?? []).length > 0
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

  <h2>Topics</h2>
  <div class="tags">
    ${problem.topicTags.map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}
  </div>

  <h2>Similar Questions</h2>
  <div>${similarHtml}</div>

  ${problem.note ? `<h2>Note</h2>\\n  <div class="problem-content">\\n    <p>${escapeHtml(problem.note)}</p>\\n  </div>\\n` : ""}

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


export function escapeScriptJson(json: string): string {
  return json.replace(/</g, "\\\u003c");
}
