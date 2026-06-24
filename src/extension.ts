import * as vscode from "vscode";
import * as path from "path";
import { getSolutionsDir, getProblemSearchCachePath } from "./paths";
import { LeetCode, ProblemList } from "leetcode-query";
import { ProblemPanel } from "./panels/ProblemPanel";
import { UserProfilePanel } from "./panels/UserProfilePanel";
import { ProblemsProvider } from "./providers/ProblemsProvider";
import { SubmissionsProvider } from "./providers/SubmissionsProvider";
import { SessionManager } from "./session/SessionManager";
import { SubmitResult, SubmitService } from "./submission/SubmitService";

interface SolutionMetadata {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  langSlug: string;
}

interface ProblemForEditor {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  codeSnippets?: { lang: string; langSlug: string; code: string }[];
}

export function activate(context: vscode.ExtensionContext) {
  const sessionManager = new SessionManager(context);
  const problemsProvider = new ProblemsProvider(sessionManager);
  const submissionsProvider = new SubmissionsProvider(sessionManager);
  const submitService = new SubmitService();
  const solutionMetadata = new Map<string, SolutionMetadata>();

  async function updateSessionContext(): Promise<void> {
    const hasSession = await sessionManager.hasSession();
    vscode.commands.executeCommand("setContext", "leetvscode:hasSession", hasSession);
  }

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "leetvscodeProblems",
      problemsProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "leetvscodeSubmissions",
      submissionsProvider
    )
  );

  updateSessionContext();

  // Ensure view title-bar actions stay visible even when the view isn't hovered
  const viewConfig = vscode.workspace.getConfiguration("workbench.view");
  if (!viewConfig.get<boolean>("alwaysShowHeaderActions")) {
    viewConfig.update("alwaysShowHeaderActions", true, vscode.ConfigurationTarget.Global);
  }

  // --- Commands ---

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.showDailyChallenge",
      async () => {
        const lc = await sessionManager.getLeetCodeClient();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Fetching daily challenge...",
            cancellable: false,
          },
          async () => {
            try {
              const daily = await lc.daily();
              if (!daily?.question) {
                vscode.window.showErrorMessage(
                  "Could not fetch the daily challenge."
                );
                return;
              }
              ProblemPanel.createOrShow(
                context.extensionUri,
                daily.question,
                daily.date
              );
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to fetch daily challenge: ${String(err)}`
              );
            }
          }
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.searchProblem",
      async (slugArg?: unknown) => {
        const input =
          (typeof slugArg === "string" ? slugArg : undefined) ??
          (await vscode.window.showInputBox({
            placeHolder: "Search Problem",
            validateInput: (v) =>
              v.trim() ? null : "Please enter a problem number, title, or slug",
          }));
        if (!input) {
          return;
        }

        const trimmed = input.trim();
        const lc = await sessionManager.getLeetCodeClient();

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Searching for "${trimmed}"...`,
            cancellable: false,
          },
          async () => {
            try {
              const slug = await resolveToSlug(trimmed, lc);
              if (!slug) {
                vscode.window.showErrorMessage(
                  `No problem found matching "${trimmed}".`
                );
                return;
              }

              const problem = await lc.problem(slug);
              if (!problem) {
                vscode.window.showErrorMessage(
                  `Problem "${slug}" not found.`
                );
                return;
              }
              ProblemPanel.createOrShow(context.extensionUri, problem);
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to fetch problem: ${String(err)}`
              );
            }
          }
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.viewAllProblems",
      async () => {
        await vscode.commands.executeCommand("leetvscodeProblems.focus");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.showUserProfile",
      async () => {
        const username = await vscode.window.showInputBox({
          prompt: "Enter LeetCode username",
          placeHolder: "username",
          validateInput: (v) =>
            v.trim() ? null : "Please enter a username",
        });
        if (!username) {
          return;
        }

        const lc = await sessionManager.getLeetCodeClient();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching profile for "${username}"...`,
            cancellable: false,
          },
          async () => {
            try {
              const [profile, contestInfo] = await Promise.all([
                lc.user(username.trim()),
                lc.user_contest_info(username.trim()),
              ]);

              if (!profile?.matchedUser) {
                vscode.window.showErrorMessage(
                  `User "${username}" not found.`
                );
                return;
              }

              UserProfilePanel.createOrShow(
                context.extensionUri,
                profile,
                contestInfo
              );
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to fetch profile: ${String(err)}`
              );
            }
          }
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.openSolution",
      async (problemArg?: ProblemForEditor, snippetIndex = 0) => {
        const lc = await sessionManager.getLeetCodeClient();
        const problem = problemArg ?? (await pickProblem(lc));
        if (!problem) {
          return;
        }

        const snippets = problem.codeSnippets ?? [];
        if (!snippets.length) {
          vscode.window.showErrorMessage(
            `No code snippets are available for "${problem.title}".`
          );
          return;
        }

        const snippet =
          snippets[snippetIndex] ??
          (await pickSnippet(snippets, "Select language for solution file"));
        if (!snippet) {
          return;
        }

        const document = await openSolutionDocument(problem, snippet);
        solutionMetadata.set(document.uri.toString(), {
          questionId: problem.questionId,
          questionFrontendId: problem.questionFrontendId,
          title: problem.title,
          titleSlug: problem.titleSlug,
          langSlug: snippet.langSlug,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.submitSolution",
      async () => {
        if (!(await sessionManager.hasSession())) {
          const action = await vscode.window.showWarningMessage(
            "You need to set your LeetCode session before submitting.",
            "Set Session"
          );
          if (action === "Set Session") {
            await vscode.commands.executeCommand("leetvscode.setSession");
          }
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(
            "Open a solution file before submitting."
          );
          return;
        }

        const lc = await sessionManager.getLeetCodeClient();
        const metadata = await resolveSolutionMetadata(
          editor.document,
          solutionMetadata,
          lc
        );
        if (!metadata) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Submitting "${metadata.title}"...`,
            cancellable: false,
          },
          async () => {
            try {
              const credential = await sessionManager.getCredential();
              const session = credential.session;
              const csrf = credential.csrf;
              if (!session || !csrf) {
                throw new Error("Missing LeetCode session or CSRF token.");
              }

              const result = await submitService.submit({
                titleSlug: metadata.titleSlug,
                questionId: metadata.questionId,
                langSlug: metadata.langSlug,
                code: editor.document.getText(),
                session,
                csrf,
              });

              showSubmissionResult(result, metadata);
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to submit solution: ${formatError(err)}`
              );
            }
          }
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.setSession",
      async () => {
        const session = await vscode.window.showInputBox({
          prompt:
            "Paste your LEETCODE_SESSION cookie value (from browser DevTools)",
          placeHolder: "eyJ0eXAiOiJKV1QiLCJhb...",
          password: true,
          validateInput: (v) =>
            v.trim() ? null : "Session cookie cannot be empty",
        });
        if (!session) {
          return;
        }
        await sessionManager.setSession(session.trim());
        updateSessionContext();
        problemsProvider.refresh();
        submissionsProvider.refresh();
        vscode.window.showInformationMessage(
          "LeetCode session saved. You can now access authenticated features."
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.clearSession",
      async () => {
        await sessionManager.clearSession();
        updateSessionContext();
        problemsProvider.refresh();
        submissionsProvider.refresh();
        vscode.window.showInformationMessage("LeetCode session cleared.");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.showMySubmissions",
      async () => {
        if (!(await sessionManager.hasSession())) {
          const action = await vscode.window.showWarningMessage(
            "You need to set your LeetCode session to view submissions.",
            "Set Session"
          );
          if (action === "Set Session") {
            await vscode.commands.executeCommand(
              "leetvscode.setSession"
            );
          }
          return;
        }

        submissionsProvider.refresh();
        await vscode.commands.executeCommand("leetvscodeSubmissions.focus");
      }
    )
  );
}

export function deactivate() { }

type ProblemSummary = ProblemList["questions"][number];

async function fetchAllProblems(lc: LeetCode): Promise<ProblemSummary[]> {
  const cachePath = vscode.Uri.file(getProblemSearchCachePath());
  try {
    const data = await vscode.workspace.fs.readFile(cachePath);
    const parsed = JSON.parse(Buffer.from(data).toString("utf8"));
    if (parsed && parsed.problems && parsed.problems.length > 0) {
      return parsed.problems;
    }
  } catch (err) {
    vscode.window.showInformationMessage(`Cache file doesn't exist at path ${cachePath}.`);
  }

  const all: ProblemSummary[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const result = await lc.problems({ limit, offset });
    const questions = result?.questions ?? [];
    if (!questions.length) {
      break;
    }
    all.push(...questions);
    offset += questions.length;
    if (questions.length < limit || all.length >= result.total) {
      break;
    }
  }

  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(getProblemSearchCachePath())));
    await vscode.workspace.fs.writeFile(
      cachePath,
      Buffer.from(JSON.stringify({ timestamp: Date.now(), problems: all }), "utf8")
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to write search index cache: ${formatError(err)}`);
  }

  return all;
}

async function resolveToSlug(
  input: string,
  lc: LeetCode
): Promise<string | undefined> {
  // get problem slug from questionFrontendId
  if (/^\d+$/.test(input)) {
    const problems = await fetchAllProblems(lc);
    const match = problems.find((p) => p.questionFrontendId === input);
    return match?.titleSlug;
  }

  // return slug as it is
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input)) {
    return input;
  }

  // get problem slug from problem title
  const problems = await fetchAllProblems(lc);
  const lowerInput = input.toLowerCase();

  // Exact title match (case-insensitive)
  const exact = problems.find(
    (p) => p.title.toLowerCase() === lowerInput
  );
  if (exact) {
    return exact.titleSlug;
  }

  // Substring match — collect all matches and let the user pick if ambiguous
  const substring = problems.filter((p) =>
    p.title.toLowerCase().includes(lowerInput)
  );

  if (substring.length === 1) {
    return substring[0].titleSlug;
  }

  if (substring.length > 1) {
    const picked = await vscode.window.showQuickPick(
      substring.map((p) => ({
        label: `${p.questionFrontendId}. ${p.title}`,
        description: p.titleSlug,
        slug: p.titleSlug,
      })),
      { placeHolder: "Multiple matches found" }
    );
    return picked?.slug;
  }

  // fallback: treat as slug
  return input.toLowerCase().replace(/\s+/g, "-");
}

async function pickProblem(lc: LeetCode): Promise<ProblemForEditor | undefined> {
  const slug = await vscode.window.showInputBox({
    prompt: "Enter problem title slug to open a solution file",
    placeHolder: "two-sum",
    validateInput: (v) => (v.trim() ? null : "Please enter a problem slug"),
  });
  if (!slug) {
    return undefined;
  }

  return lc.problem(slug.trim().toLowerCase()) as Promise<
    ProblemForEditor | undefined
  >;
}

async function pickSnippet(
  snippets: { lang: string; langSlug: string; code: string }[],
  placeHolder: string
) {
  const items = snippets.map((snippet) => ({
    label: snippet.lang,
    description: snippet.langSlug,
    snippet,
  }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder });
  return picked?.snippet;
}

async function openSolutionDocument(
  problem: ProblemForEditor,
  snippet: { lang: string; langSlug: string; code: string }
): Promise<vscode.TextDocument> {
  const language = toVsCodeLanguageId(snippet.langSlug);
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    const document = await vscode.workspace.openTextDocument({
      language,
      content: snippet.code,
    });
    await vscode.window.showTextDocument(document);
    return document;
  }

  const folder = vscode.Uri.file(getSolutionsDir());

  await vscode.workspace.fs.createDirectory(folder);

  const fileName = `${problem.questionFrontendId}-${problem.titleSlug}${toExtension(
    snippet.langSlug
  )}`;
  const uri = vscode.Uri.joinPath(folder, fileName);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(snippet.code, "utf8"));
  }

  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  return document;
}

async function resolveSolutionMetadata(
  document: vscode.TextDocument,
  metadataByUri: Map<string, SolutionMetadata>,
  lc: LeetCode
): Promise<SolutionMetadata | undefined> {
  const stored = metadataByUri.get(document.uri.toString());
  if (stored) {
    return stored;
  }

  const defaultSlug = inferSlugFromFileName(document.fileName);
  const slug = await vscode.window.showInputBox({
    prompt: "Enter problem title slug for this submission",
    value: defaultSlug,
    placeHolder: "two-sum",
    validateInput: (v) => (v.trim() ? null : "Please enter a problem slug"),
  });
  if (!slug) {
    return undefined;
  }

  const problem = (await lc.problem(slug.trim().toLowerCase())) as
    | ProblemForEditor
    | undefined;
  if (!problem) {
    vscode.window.showErrorMessage(`Problem "${slug}" not found.`);
    return undefined;
  }

  const snippets = problem.codeSnippets ?? [];
  const inferredLang = inferLangSlug(document);
  const snippet =
    snippets.find((s) => s.langSlug === inferredLang) ??
    (await pickSnippet(snippets, "Select LeetCode submission language"));
  if (!snippet) {
    return undefined;
  }

  const metadata: SolutionMetadata = {
    questionId: problem.questionId,
    questionFrontendId: problem.questionFrontendId,
    title: problem.title,
    titleSlug: problem.titleSlug,
    langSlug: snippet.langSlug,
  };
  metadataByUri.set(document.uri.toString(), metadata);
  return metadata;
}

function showSubmissionResult(
  result: SubmitResult,
  metadata: SolutionMetadata
): void {
  const baseMessage = `${metadata.questionFrontendId}. ${metadata.title}: ${result.statusMsg ?? result.state ?? "Submitted"}`;

  if (result.statusMsg === "Accepted") {
    vscode.window.showInformationMessage(
      `${baseMessage}\n${result.runtime ?? "Runtime N/A"}\n${result.memory ?? "Memory N/A"}`
    );
    return;
  }

  const details = [
    result.totalCorrect !== undefined && result.totalTestcases !== undefined
      ? `${result.totalCorrect}/${result.totalTestcases} testcases passed`
      : undefined,
    result.compileError ? `\nCompile Error: ${result.compileError}` : undefined,
    result.runtimeError ? `\nRuntime Error: ${result.runtimeError}` : undefined,
    result.lastTestcase ? `\nTestcase Failed: ${result.lastTestcase}` : undefined,
    result.expectedOutput ? `\nExpected Output: ${result.expectedOutput}` : undefined,
    result.codeOutput ? `\nYour Output: ${result.codeOutput}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  vscode.window.showWarningMessage(
    details ? `${baseMessage}\n${details}` : baseMessage
  );
}

function inferSlugFromFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/\.[^.]+$/, "");
  return base.replace(/^\d+-/, "");
}

function inferLangSlug(document: vscode.TextDocument): string | undefined {
  const byLanguageId: Record<string, string> = {
    cpp: "cpp",
    c: "c",
    csharp: "csharp",
    java: "java",
    javascript: "javascript",
    typescript: "typescript",
    python: "python3",
    python3: "python3",
    golang: "golang",
    go: "golang",
    rust: "rust",
    ruby: "ruby",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    php: "php",
    dart: "dart",
    racket: "racket",
    erlang: "erlang",
    elixir: "elixir",
  };

  return (
    byLanguageId[document.languageId] ??
    byExtension(path.extname(document.fileName))
  );
}

function byExtension(extension: string): string | undefined {
  const map: Record<string, string> = {
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".java": "java",
    ".js": "javascript",
    ".ts": "typescript",
    ".py": "python3",
    ".go": "golang",
    ".rs": "rust",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".php": "php",
    ".dart": "dart",
    ".rkt": "racket",
    ".erl": "erlang",
    ".ex": "elixir",
  };
  return map[extension];
}

function toVsCodeLanguageId(langSlug: string): string {
  const map: Record<string, string> = {
    cpp: "cpp",
    c: "c",
    csharp: "csharp",
    java: "java",
    javascript: "javascript",
    typescript: "typescript",
    python: "python",
    python3: "python",
    golang: "go",
    rust: "rust",
    ruby: "ruby",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    php: "php",
    dart: "dart",
    racket: "racket",
    erlang: "erlang",
    elixir: "elixir",
  };
  return map[langSlug] ?? "plaintext";
}

function toExtension(langSlug: string): string {
  const map: Record<string, string> = {
    cpp: ".cpp",
    c: ".c",
    csharp: ".cs",
    java: ".java",
    javascript: ".js",
    typescript: ".ts",
    python: ".py",
    python3: ".py",
    golang: ".go",
    rust: ".rs",
    ruby: ".rb",
    swift: ".swift",
    kotlin: ".kt",
    scala: ".scala",
    php: ".php",
    dart: ".dart",
    racket: ".rkt",
    erlang: ".erl",
    elixir: ".ex",
  };
  return map[langSlug] ?? ".txt";
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
