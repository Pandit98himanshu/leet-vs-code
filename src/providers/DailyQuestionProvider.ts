import * as vscode from "vscode";
import { SessionManager } from "../session/SessionManager";
import { ProblemItem } from "./ProblemsProvider";

export class DailyQuestionProvider implements vscode.TreeDataProvider<ProblemItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ProblemItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private dailyQuestions: ProblemItem[] = [];
  private isLoading = false;
  private isLoaded = false;

  private currentYear: number;
  private currentMonth: number;

  private readonly endYear = 2020;
  private readonly endMonth = 4; // April 2020

  private readonly startYear: number;
  private readonly startMonth: number;

  constructor(private readonly sessionManager: SessionManager) {
    const d = new Date();
    this.currentYear = d.getFullYear();
    this.currentMonth = d.getMonth() + 1;
    this.startYear = this.currentYear;
    this.startMonth = this.currentMonth;

    this.sessionManager.onDidChangeSession(() => this.refresh());
  }

  refresh(): void {
    const d = new Date();
    this.currentYear = d.getFullYear();
    this.currentMonth = d.getMonth() + 1;

    this.dailyQuestions = [];
    this.isLoaded = false;
    this.isLoading = false;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProblemItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProblemItem): Promise<ProblemItem[]> {
    if (element) {
      return [];
    }

    if (!this.isLoaded && !this.isLoading) {
      // Load current month asynchronously, returning loading indicator for now
      this.loadMonth();
    }

    if (this.isLoading) {
      return [
        new ProblemItem(
          `Loading ${this.currentYear}-${this.currentMonth.toString().padStart(2, '0')}...`,
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "sync~spin"
        )
      ];
    }

    if (this.dailyQuestions.length === 0 && this.isLoaded) {
      return [
        new ProblemItem(
          "No daily questions found",
          undefined,
          vscode.TreeItemCollapsibleState.None,
          "info"
        )
      ];
    }

    return this.dailyQuestions;
  }

  public hasPrevMonth(): boolean {
    if (this.currentYear < this.endYear) return false;
    if (this.currentYear === this.endYear && this.currentMonth <= this.endMonth) return false;
    return true;
  }

  public hasNextMonth(): boolean {
    if (this.currentYear > this.startYear) return false;
    if (this.currentYear === this.startYear && this.currentMonth >= this.startMonth) return false;
    return true;
  }

  public async prevMonth(): Promise<void> {
    if (this.isLoading || !this.hasPrevMonth()) return;

    this.currentMonth--;
    if (this.currentMonth === 0) {
      this.currentMonth = 12;
      this.currentYear--;
    }

    this.isLoaded = false;
    await this.loadMonth();
  }

  public async nextMonth(): Promise<void> {
    if (this.isLoading || !this.hasNextMonth()) return;

    this.currentMonth++;
    if (this.currentMonth === 13) {
      this.currentMonth = 1;
      this.currentYear++;
    }

    this.isLoaded = false;
    await this.loadMonth();
  }

  private async loadMonth(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.dailyQuestions = [];

    // Update command enablement context based on pagination boundaries
    vscode.commands.executeCommand("setContext", "leetvscode:hasPrevMonth", this.hasPrevMonth());
    vscode.commands.executeCommand("setContext", "leetvscode:hasNextMonth", this.hasNextMonth());

    this._onDidChangeTreeData.fire();

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: `Loading daily questions for ${this.currentYear}-${this.currentMonth.toString().padStart(2, '0')}...`,
        },
        async () => {
          const lc = await this.sessionManager.getLeetCodeClient();
          const query = `
            query dailyCodingQuestionRecords($year: Int!, $month: Int!) {
              dailyCodingChallengeV2(year: $year, month: $month) {
                challenges {
                  date
                  link
                  question {
                    questionFrontendId
                    title
                    titleSlug
                    status
                    isPaidOnly
                    difficulty
                    topicTags {
                      name
                      slug
                    }
                  }
                }
              }
            }
          `;

          const res = await lc.graphql({
            query,
            variables: { year: this.currentYear, month: this.currentMonth }
          });

          const data = res as any;
          const challenges = data?.data?.dailyCodingChallengeV2?.challenges || [];

          if (challenges.length > 0) {
            const reversed = [...challenges].reverse();

            const newItems = reversed.map((c: any) => {
              const q = c.question;
              if (!q) return null;

              const label = `${c.date}: ${q.questionFrontendId}. ${q.title}`;
              const tags = (q.topicTags || []).map((t: any) => t.name).join(", ");

              const item = new ProblemItem(
                label,
                {
                  command: "leetvscode.searchProblem",
                  title: "Open Problem",
                  arguments: [q.titleSlug],
                },
                vscode.TreeItemCollapsibleState.None,
                this.getProblemStatusIcon(q.status, q.isPaidOnly),
                tags,
                q.difficulty as any,
                q
              );
              item.tooltip = tags ? `${label}\n${tags}` : label;
              return item;
            }).filter((item: any) => item !== null);

            this.dailyQuestions = newItems;
          }
        }
      );
    } catch (err) {
      console.error(`Failed to load daily questions:`, err);
      vscode.window.showErrorMessage(`Failed to load daily questions: ${err}`);
    } finally {
      this.isLoading = false;
      this.isLoaded = true;

      // Re-evaluate context just in case
      vscode.commands.executeCommand("setContext", "leetvscode:hasPrevMonth", this.hasPrevMonth());
      vscode.commands.executeCommand("setContext", "leetvscode:hasNextMonth", this.hasNextMonth());

      this._onDidChangeTreeData.fire();
    }
  }

  private getProblemStatusIcon(
    status: string | null | undefined,
    isPaidOnly: boolean | undefined,
  ): string | undefined {
    if (isPaidOnly && !status) {
      return "lock";
    }

    if (!status) {
      return "list-map";
    }

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "ac" || normalizedStatus === "accepted") {
      return "check";
    }

    return "target";
  }
}
