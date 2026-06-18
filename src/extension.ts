import * as vscode from "vscode";
import { LeetCode, Credential } from "leetcode-query";
import { ProblemPanel } from "./panels/ProblemPanel";
import { UserProfilePanel } from "./panels/UserProfilePanel";
import { ProblemsProvider } from "./providers/ProblemsProvider";
import { SessionManager } from "./session/SessionManager";

export function activate(context: vscode.ExtensionContext) {
  const sessionManager = new SessionManager(context);
  const problemsProvider = new ProblemsProvider(sessionManager);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "leetvscodeProblems",
      problemsProvider
    )
  );

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
      async () => {
        const slug = await vscode.window.showInputBox({
          prompt: "Enter problem title slug (e.g. two-sum, longest-substring)",
          placeHolder: "two-sum",
          validateInput: (v) =>
            v.trim() ? null : "Please enter a problem slug",
        });
        if (!slug) {
          return;
        }

        const lc = await sessionManager.getLeetCodeClient();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching problem "${slug}"...`,
            cancellable: false,
          },
          async () => {
            try {
              const problem = await lc.problem(slug.trim().toLowerCase());
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
      "leetvscode.browseProblems",
      async () => {
        const config = vscode.workspace.getConfiguration("leetvscode");
        const defaultDifficulty = config.get<string>(
          "defaultDifficulty",
          "All"
        );

        const difficulty = await vscode.window.showQuickPick(
          ["All", "Easy", "Medium", "Hard"],
          {
            placeHolder: "Select difficulty",
            title: "Browse LeetCode Problems",
          }
        );
        if (difficulty === undefined) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Loading problems...",
            cancellable: false,
          },
          async () => {
            try {
              const lc = await sessionManager.getLeetCodeClient();
              const filter =
                difficulty === "All"
                  ? {}
                  : {
                      difficulty: difficulty.toUpperCase() as
                        | "EASY"
                        | "MEDIUM"
                        | "HARD",
                    };
              const result = await lc.problems({
                limit: 50,
                offset: 0,
                filters: filter,
              });

              if (!result?.questions?.length) {
                vscode.window.showInformationMessage("No problems found.");
                return;
              }

              const items: vscode.QuickPickItem[] = result.questions.map(
                (q) => ({
                  label: `$(symbol-numeric) ${q.questionFrontendId}. ${q.title}`,
                  description: q.difficulty,
                  detail: q.topicTags.map((t) => t.name).join(", "),
                })
              );

              const picked = await vscode.window.showQuickPick(items, {
                placeHolder: `Showing ${result.questions.length} problems — select one to open`,
                title: `LeetCode Problems (${difficulty})`,
                matchOnDescription: true,
                matchOnDetail: true,
              });

              if (!picked) {
                return;
              }

              // Extract slug from the selected problem
              const idx = items.indexOf(picked);
              const question = result.questions[idx];

              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: `Loading "${question.title}"...`,
                  cancellable: false,
                },
                async () => {
                  try {
                    const problem = await lc.problem(question.titleSlug);
                    if (problem) {
                      ProblemPanel.createOrShow(context.extensionUri, problem);
                    }
                  } catch (err) {
                    vscode.window.showErrorMessage(
                      `Failed to load problem: ${String(err)}`
                    );
                  }
                }
              );
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to browse problems: ${String(err)}`
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

        const lc = await sessionManager.getLeetCodeClient();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Fetching your recent submissions...",
            cancellable: false,
          },
          async () => {
            try {
              const submissions = await lc.submissions({ limit: 20, offset: 0 });
              if (!submissions.length) {
                vscode.window.showInformationMessage(
                  "No submissions found."
                );
                return;
              }

              const items: vscode.QuickPickItem[] = submissions.map(
                (s) => {
                  const icon =
                    s.statusDisplay === "Accepted"
                      ? "$(pass-filled)"
                      : "$(error)";
                  return {
                    label: `${icon} ${s.title}`,
                    description: `${s.statusDisplay} · ${s.lang}`,
                    detail: `Runtime: ${s.runtime}ms · Memory: ${s.memory}MB · ${s.time}`,
                  };
                }
              );

              const picked = await vscode.window.showQuickPick(items, {
                placeHolder: "Select a submission to view the problem",
                title: "My Recent Submissions (last 20)",
              });

              if (!picked) {
                return;
              }

              const idx = items.indexOf(picked);
              const sub = submissions[idx];

              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: `Loading "${sub.title}"...`,
                  cancellable: false,
                },
                async () => {
                  try {
                    const problem = await lc.problem(sub.titleSlug);
                    if (problem) {
                      ProblemPanel.createOrShow(context.extensionUri, problem);
                    }
                  } catch (err) {
                    vscode.window.showErrorMessage(
                      `Failed to load problem: ${String(err)}`
                    );
                  }
                }
              );
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to fetch submissions: ${String(err)}`
              );
            }
          }
        );
      }
    )
  );
}

export function deactivate() {}
