import * as vscode from "vscode";
import * as path from "path";
import { getSolutionsDir, getProblemSearchCachePath } from "./paths";
import { LeetCode, ProblemList } from "leetcode-query";
import { ProblemPanel } from "./panels/ProblemPanel";
import { UserProfilePanel } from "./panels/UserProfilePanel";
import { ProblemsProvider } from "./providers/ProblemsProvider";
import { SubmissionsProvider } from "./providers/SubmissionsProvider";
import { TestResultsProvider } from "./providers/TestResultsProvider";
import { DailyQuestionProvider } from "./providers/DailyQuestionProvider";
import { SessionManager } from "./session/SessionManager";
import { SubmitResult, SubmitService } from "./submission/SubmitService";
import { TestService, TestResult } from "./submission/TestService";

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

class LeetCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private solutionMetadata: Map<string, SolutionMetadata>) { }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const baseName = path.basename(document.fileName);
    const hasMetadata = this.solutionMetadata.has(document.uri.toString());
    const matchesPattern = /^\\d+-/.test(baseName);

    if (!hasMetadata && !matchesPattern) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, {
        title: "$(play) Test Solution",
        command: "leetvscode.testSolution",
      }),
      new vscode.CodeLens(range, {
        title: "$(cloud-upload) Submit Solution",
        command: "leetvscode.submitSolution",
      })
    ];
  }
}

export function activate(context: vscode.ExtensionContext) {
  const sessionManager = new SessionManager(context);
  const problemsProvider = new ProblemsProvider(sessionManager);
  const submissionsProvider = new SubmissionsProvider(sessionManager);
  const dailyQuestionProvider = new DailyQuestionProvider(sessionManager);
  const testResultsProvider = new TestResultsProvider(context.extensionUri);
  const submitService = new SubmitService();
  const testService = new TestService();
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

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "leetvscodeDailyQuestions",
      dailyQuestionProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TestResultsProvider.viewType,
      testResultsProvider
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      new LeetCodeLensProvider(solutionMetadata)
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
      "leetvscode.refreshDailyQuestions",
      () => {
        dailyQuestionProvider.refresh();
      }
    )
  );

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
              const caData = await fetchLeetcodeCaData(daily.question.questionFrontendId);
              if (daily.question.isPaidOnly && !daily.question.content && caData.content) {
                daily.question.content = caData.content;
              }
              (daily.question as any).companyTags = caData.companyTags;
              (daily.question as any).premiumSolution = caData.premiumSolution;
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
        const lc = await sessionManager.getLeetCodeClient();

        let targetSlug: string | undefined = typeof slugArg === "string" ? slugArg : undefined;

        if (!targetSlug) {
          let problems: ProblemSummary[] = [];

          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading problems...",
            cancellable: false
          }, async () => {
            problems = await fetchAllProblems(lc);
          });

          if (!problems.length) {
            vscode.window.showErrorMessage("Failed to load problems.");
            return;
          }

          const picked = await vscode.window.showQuickPick(
            problems.map((p) => ({
              label: `${p.questionFrontendId}. ${p.title}`,
              description: p.difficulty,
              slug: p.titleSlug,
              detail: p.topicTags?.map(t => t.name).join(", ")
            })),
            {
              placeHolder: "Search problems",
              matchOnDescription: true,
              matchOnDetail: true
            }
          );

          if (!picked) {
            return;
          }
          targetSlug = picked.slug;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Opening problem...`,
            cancellable: false,
          },
          async () => {
            try {
              const problem = await lc.problem(targetSlug!);
              if (!problem) {
                vscode.window.showErrorMessage(
                  `Problem not found.`
                );
                return;
              }
              const caData = await fetchLeetcodeCaData(problem.questionFrontendId);
              if (problem.isPaidOnly && !problem.content && caData.content) {
                problem.content = caData.content;
              }
              (problem as any).companyTags = caData.companyTags;
              (problem as any).premiumSolution = caData.premiumSolution;
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
      "leetvscode.openSubmission",
      async (submissionId: number, titleSlug: string) => {
        const lc = await sessionManager.getLeetCodeClient();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching submission...`,
            cancellable: false,
          },
          async () => {
            try {
              const detail = await lc.submission(Number(submissionId));
              if (!detail) {
                 vscode.window.showErrorMessage("Submission not found.");
                 return;
              }
              const document = await vscode.workspace.openTextDocument({
                content: detail.code,
                language: detail.lang?.name || "plaintext" 
              });
              
              if (detail.question?.questionId) {
                 solutionMetadata.set(document.uri.toString(), {
                   questionId: detail.question.questionId,
                   questionFrontendId: "",
                   title: titleSlug,
                   titleSlug: detail.question.titleSlug || titleSlug,
                   langSlug: detail.lang?.name || ""
                 });
              }

              await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Active, preserveFocus: false, preview: false });
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to fetch submission: ${String(err)}`
              );
            }
          }
        );
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

              showSubmissionResult(result, metadata, testResultsProvider);
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
      "leetvscode.testSolution",
      async () => {
        if (!(await sessionManager.hasSession())) {
          const action = await vscode.window.showWarningMessage(
            "You need to set your LeetCode session before testing.",
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
            "Open a solution file before testing."
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

        let dataInput = "";
        const solutionUri = editor.document.uri;
        let testcasesUri: vscode.Uri | undefined;

        if (solutionUri.scheme === "file") {
          testcasesUri = solutionUri.with({ path: solutionUri.path.replace(/\.[^.]+$/, '.tcs') });
          try {
            const data = await vscode.workspace.fs.readFile(testcasesUri);
            dataInput = Buffer.from(data).toString("utf8");
          } catch {
            // File doesn't exist, dataInput remains empty
          }
        }

        if (!dataInput.trim()) {
          try {
            const problem = await lc.problem(metadata.titleSlug);
            dataInput = problem?.exampleTestcases || "";
            if (dataInput && testcasesUri) {
              await vscode.workspace.fs.writeFile(testcasesUri, Buffer.from(dataInput, "utf8"));
            }
          } catch (err) {
            vscode.window.showWarningMessage("Could not fetch default testcases: " + formatError(err));
          }
        } else if (testcasesUri) {
          vscode.window.showInformationMessage(`Using test cases from ${path.basename(testcasesUri.fsPath)}`);
        }

        if (testcasesUri) {
          try {
            await vscode.window.showTextDocument(testcasesUri, { viewColumn: vscode.ViewColumn.Active, preserveFocus: false });
            await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');
            await vscode.commands.executeCommand('workbench.action.focusAboveGroup');
          } catch (e) {
            console.error("Failed to open test cases file", e);
          }
        }

        if (!dataInput) {
          vscode.window.showErrorMessage("No testcases found for this problem.");
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Testing "${metadata.title}"...`,
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

              const result = await testService.test({
                titleSlug: metadata.titleSlug,
                questionId: metadata.questionId,
                langSlug: metadata.langSlug,
                code: editor.document.getText(),
                dataInput,
                session,
                csrf,
              });

              testResultsProvider.updateResult(result, { ...metadata, dataInput });
              await vscode.commands.executeCommand("leetvscodeTestResultsView.focus");
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to test solution: ${formatError(err)}`
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.clearTestResults",
      () => {
        testResultsProvider.clear();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.prevMonthDaily",
      () => {
        dailyQuestionProvider.prevMonth();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "leetvscode.nextMonthDaily",
      () => {
        dailyQuestionProvider.nextMonth();
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
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false, preview: false });
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
  metadata: SolutionMetadata,
  testResultsProvider: TestResultsProvider
): void {
  testResultsProvider.updateSubmitResult(result, metadata);
  vscode.commands.executeCommand("leetvscodeTestResultsView.focus");
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

async function fetchLeetcodeCaData(frontendId: string): Promise<{ content: string | null; companyTags: string[]; premiumSolution?: { title: string; link: string } }> {
  try {
    const url = `https://leetcode.ca/all/${frontendId}.html`;
    const res = await fetch(url);
    if (!res.ok) return { content: null, companyTags: [] };
    const data = await res.text();
    
    let extractedContent: string | null = null;
    const startIndex = data.indexOf('<div class="markdown-body div-width"');
    if (startIndex !== -1) {
      const endIndex = data.indexOf('<h3>Difficulty:</h3>', startIndex);
      if (endIndex !== -1) {
        const content = data.substring(startIndex, endIndex);
        const lastDiv = content.lastIndexOf('<div');
        if (lastDiv !== -1) {
          extractedContent = content.substring(0, lastDiv).trim() + '</div>';
        }
      }
    }
    
    const companyTags: string[] = [];
    const companyStartIndex = data.indexOf('<h3>Company:</h3>');
    if (companyStartIndex !== -1) {
      const companyEndIndex = data.indexOf('</div>', companyStartIndex);
      if (companyEndIndex !== -1) {
        const companySection = data.substring(companyStartIndex, companyEndIndex);
        const regex = /<a[^>]*>(.*?)<\/a>/g;
        let match;
        while ((match = regex.exec(companySection)) !== null) {
          companyTags.push(match[1].trim());
        }
      }
    }
    
    let premiumSolution: { title: string; link: string; content?: string } | undefined;
    const solutionStartIndex = data.indexOf('<h3>Problem Solution</h3>');
    if (solutionStartIndex !== -1) {
      const solutionEndIndex = data.indexOf('</div>', solutionStartIndex);
      if (solutionEndIndex !== -1) {
        const section = data.substring(solutionStartIndex, solutionEndIndex);
        const regex = /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/;
        const match = regex.exec(section);
        if (match) {
          premiumSolution = { link: match[1], title: match[2].trim() };
        }
      }
    }

    // Fetch the actual question and solution from the solution page for better formatting/content
    if (premiumSolution && premiumSolution.link) {
      try {
        const solRes = await fetch(premiumSolution.link);
        if (solRes.ok) {
          const solData = await solRes.text();
          
          // Extract question
          let qStartIndex = solData.indexOf('<h2 id="description">');
          if (qStartIndex === -1) qStartIndex = solData.indexOf('<h2>Description</h2>');
          if (qStartIndex === -1) qStartIndex = solData.indexOf('<h1 id="description">');
          if (qStartIndex === -1) qStartIndex = solData.indexOf('<h1>Description</h1>');
          if (qStartIndex === -1) qStartIndex = solData.indexOf('<p>Formatted question description:');

          if (qStartIndex !== -1) {
            let qEndIndex = solData.length;
            const endMarkers = [
              '<h1 id="algorithm">', '<h1>Algorithm</h1>', '<h2 id="algorithm">', '<h2>Algorithm</h2>',
              '<h1 id="solution">', '<h1>Solution</h1>', '<h2 id="solution">', '<h2>Solution</h2>',
              '<h1 id="code">', '<h2 id="code">', '<h1>Code</h1>', '<h2>Code</h2>'
            ];
            for (const marker of endMarkers) {
              const idx = solData.indexOf(marker, qStartIndex);
              if (idx !== -1 && idx < qEndIndex) {
                qEndIndex = idx;
              }
            }
            
            let questionHtml = solData.substring(qStartIndex, qEndIndex);
            const endOfFormatted = questionHtml.indexOf('</p>');
            if (questionHtml.startsWith('<p>Formatted') && endOfFormatted !== -1) {
              questionHtml = questionHtml.substring(endOfFormatted + 4).trim();
            }
            
            if (questionHtml) {
              extractedContent = questionHtml;
            }
          }
          
          // Extract solution/algorithm
          const algoStartMarkers = [
            '<h1 id="algorithm">', '<h1>Algorithm</h1>', '<h2 id="algorithm">', '<h2>Algorithm</h2>',
            '<h1 id="solution">', '<h1>Solution</h1>', '<h2 id="solution">', '<h2>Solution</h2>'
          ];
          let algoStartIndex = -1;
          for (const marker of algoStartMarkers) {
            const idx = solData.indexOf(marker);
            if (idx !== -1 && (algoStartIndex === -1 || idx < algoStartIndex)) {
              algoStartIndex = idx;
            }
          }
          
          if (algoStartIndex !== -1) {
            let algoEndIndex = solData.length;
            const codeMarkers = [
              '<ul class="uk-tab"',
              '<h1 id="code">', '<h1>Code</h1>', '<h2 id="code">', '<h2>Code</h2>',
              '<h1 id="all-problems">', '<h1>All Problems</h1>'
            ];
            for (const marker of codeMarkers) {
              const idx = solData.indexOf(marker, algoStartIndex);
              if (idx !== -1 && idx < algoEndIndex) {
                algoEndIndex = idx;
              }
            }
            
            let algoHtml = solData.substring(algoStartIndex, algoEndIndex).trim();
            if (algoHtml) {
              premiumSolution.content = algoHtml;
            }
          }
        }
      } catch (err) {
        // ignore errors and fallback to the original extractedContent
      }
    }

    return { content: extractedContent, companyTags, premiumSolution };
  } catch (err) {
    return { content: null, companyTags: [] };
  }
}

