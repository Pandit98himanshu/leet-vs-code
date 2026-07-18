import { TestResult } from "../submission/TestService";
import { SubmitResult } from "../submission/SubmitService";
import { escapeHtml } from "../utils/html";

function getCommonResultHtml(result: TestResult | SubmitResult): string {
  let content = "";
  if (result.totalCorrect !== undefined && result.totalTestcases !== undefined) {
    const isTestResult = (result as TestResult).correctAnswer !== undefined;
    let colorStyle = "";
    if (isTestResult) {
      colorStyle = (result as TestResult).correctAnswer ? ' style="color: green;"' : ' style="color: red;"';
    }
    content += `<p${colorStyle}>${result.totalCorrect}/${result.totalTestcases} testcases passed.</p>`;
  }

  if (result.runtime && result.memory) {
    content += `<p><strong>Runtime:</strong> ${result.runtime} | <strong>Memory:</strong> ${result.memory}</p>`;
  }

  if (result.compileError) {
    content += `<h4>Compile Error</h4><pre><code>${escapeHtml(result.compileError)}</code></pre>`;
  }

  if (result.runtimeError) {
    content += `<h4>Runtime Error</h4><pre><code>${escapeHtml(result.runtimeError)}</code></pre>`;
  }
  return content;
}

export function getTestResultHtml(result: TestResult, metadata: { title: string; questionFrontendId: string; dataInput?: string }, styleUri: string): string {
  let content = `<h2>${metadata.questionFrontendId}. ${metadata.title}</h2>`;
  content += `<p><strong>Status:</strong> ${result.statusMsg ?? result.state ?? "Tested"}</p>`;

  content += getCommonResultHtml(result);

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
        content += `<p><strong>Input:</strong> <pre><code>${escapeHtml(inputTestcases[i])}</code></pre></p>`;
      }
      const outputColorStyle = result.codeAnswer[i] !== result.expectedCodeAnswer[i]
        ? ' style="color: red;"' : ' style="color: green;"';
      content += `<p><strong>Output:</strong> <pre><code${outputColorStyle}>${escapeHtml(result.codeAnswer[i])}</code></pre></p>`;
      content += `<p><strong>Expected:</strong> <pre><code>${escapeHtml(result.expectedCodeAnswer[i])}</code></pre></p>`;
    }
  }

  return wrapHtml(content, styleUri);
}

export function getSubmitResultHtml(result: SubmitResult, metadata: { title: string; questionFrontendId: string }, styleUri: string): string {
  let content = `<h2>${metadata.questionFrontendId}. ${metadata.title}</h2>`;
  content += `<h3>Submission Result</h3>`;

  const isAccepted = result.statusMsg === "Accepted";
  const statusColorStyle = isAccepted ? ' style="color: green;"' : ' style="color: red;"';
  content += `<p><strong>Status:</strong> <span${statusColorStyle}>${result.statusMsg ?? result.state ?? "Submitted"}</span></p>`;

  content += getCommonResultHtml(result);

  if (result.lastTestcase) {
    content += `<h4>Testcase Failed</h4>`;
    content += `<p><strong>Input:</strong> <pre><code>${escapeHtml(result.lastTestcase)}</code></pre></p>`;
    if (result.codeOutput) {
      content += `<p><strong>Output:</strong> <pre><code style="color: red;">${escapeHtml(result.codeOutput)}</code></pre></p>`;
    }
    if (result.expectedOutput) {
      content += `<p><strong>Expected:</strong> <pre><code>${escapeHtml(result.expectedOutput)}</code></pre></p>`;
    }
  }

  return wrapHtml(content, styleUri);
}

export function getLoadingHtml(message: string, styleUri: string): string {
  return wrapHtml(message, styleUri);
}

function wrapHtml(content: string, styleUri: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Results</title>
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  ${content}
</body>
</html>`;
}
