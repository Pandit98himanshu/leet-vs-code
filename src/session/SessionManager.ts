import * as vscode from "vscode";
import { LeetCode, Credential } from "leetcode-query";

const SESSION_KEY = "leetvscode.session";

export class SessionManager {
  private readonly _onDidChangeSession = new vscode.EventEmitter<void>();
  /** Fires whenever the session is set or cleared. */
  readonly onDidChangeSession = this._onDidChangeSession.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async setSession(cookie: string): Promise<void> {
    await this.context.secrets.store(SESSION_KEY, cookie);
    this._onDidChangeSession.fire();
  }

  async clearSession(): Promise<void> {
    await this.context.secrets.delete(SESSION_KEY);
    this._onDidChangeSession.fire();
  }

  async hasSession(): Promise<boolean> {
    const session = await this.context.secrets.get(SESSION_KEY);
    return !!session;
  }

  async getSession(): Promise<string | undefined> {
    return this.context.secrets.get(SESSION_KEY);
  }

  async getCredential(): Promise<Credential> {
    const credential = new Credential();
    await credential.init(await this.getSession());
    return credential;
  }

  async getLeetCodeClient(): Promise<LeetCode> {
    const session = await this.getSession();
    if (session) {
      const credential = await this.getCredential();
      return new LeetCode(credential);
    }
    return new LeetCode();
  }
}
