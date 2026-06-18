import * as vscode from "vscode";
import { LeetCode, Credential } from "leetcode-query";

const SESSION_KEY = "leetvscode.session";

export class SessionManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async setSession(cookie: string): Promise<void> {
    await this.context.secrets.store(SESSION_KEY, cookie);
  }

  async clearSession(): Promise<void> {
    await this.context.secrets.delete(SESSION_KEY);
  }

  async hasSession(): Promise<boolean> {
    const session = await this.context.secrets.get(SESSION_KEY);
    return !!session;
  }

  async getLeetCodeClient(): Promise<LeetCode> {
    const session = await this.context.secrets.get(SESSION_KEY);
    if (session) {
      const credential = new Credential();
      await credential.init(session);
      return new LeetCode(credential);
    }
    return new LeetCode();
  }
}