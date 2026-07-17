interface SubmitParams {
  titleSlug: string;
  questionId: string;
  langSlug: string;
  code: string;
  session: string;
  csrf: string;
}

export interface SubmitResult {
  submissionId: number;
  state?: string;
  statusMsg?: string;
  runtime?: string;
  memory?: string;
  totalCorrect?: number;
  totalTestcases?: number;
  compileError?: string;
  runtimeError?: string;
  lastTestcase?: string;
  expectedOutput?: string;
  codeOutput?: string;
}

const BASE_URL = "https://leetcode.com";
const USER_AGENT = "Mozilla/5.0 Leet-VS-Code";
const MAX_POLL_ATTEMPTS = 30;
const POLL_DELAY_MS = 1000;

export class SubmitService {
  async submit(params: SubmitParams): Promise<SubmitResult> {
    const submitResponse = await fetch(
      `${BASE_URL}/problems/${params.titleSlug}/submit/`,
      {
        method: "POST",
        headers: this.getHeaders(
          params,
          `${BASE_URL}/problems/${params.titleSlug}/`
        ),
        body: JSON.stringify({
          lang: params.langSlug,
          question_id: params.questionId,
          typed_code: params.code,
        }),
      }
    );

    const submitBody = await readJson<{ submission_id?: number; error?: string }>(
      submitResponse
    );
    if (!submitResponse.ok || !submitBody.submission_id) {
      throw new Error(
        submitBody.error ||
        `LeetCode submit failed with HTTP ${submitResponse.status}`
      );
    }

    return this.pollResult(params, submitBody.submission_id);
  }

  private async pollResult(
    params: SubmitParams,
    submissionId: number
  ): Promise<SubmitResult> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await delay(POLL_DELAY_MS);

      const response = await fetch(
        `${BASE_URL}/submissions/detail/${submissionId}/check/`,
        {
          method: "GET",
          headers: this.getHeaders(
            params,
            `${BASE_URL}/submissions/detail/${submissionId}/`
          ),
        }
      );
      const body = await readJson<LeetCodeCheckResponse>(response);
      if (!response.ok) {
        throw new Error(
          `LeetCode status check failed with HTTP ${response.status}`
        );
      }

      if (body.state !== "PENDING" && body.state !== "STARTED") {
        return {
          submissionId,
          state: body.state,
          statusMsg: body.status_msg,
          runtime: body.status_runtime,
          memory: body.status_memory,
          totalCorrect: body.total_correct,
          totalTestcases: body.total_testcases,
          compileError: body.compile_error || body.full_compile_error,
          runtimeError: body.runtime_error,
          lastTestcase: body.last_testcase,
          expectedOutput: body.expected_output,
          codeOutput: body.code_output,
        };
      }
    }

    return { submissionId, state: "PENDING", statusMsg: "Pending" };
  }

  private getHeaders(
    params: SubmitParams,
    referer: string
  ): Record<string, string> {
    return {
      "content-type": "application/json",
      origin: BASE_URL,
      referer,
      cookie: `csrftoken=${params.csrf}; LEETCODE_SESSION=${params.session};`,
      "x-csrftoken": params.csrf,
      "user-agent": USER_AGENT,
    };
  }
}

interface LeetCodeCheckResponse {
  state?: string;
  status_msg?: string;
  status_runtime?: string;
  status_memory?: string;
  total_correct?: number;
  total_testcases?: number;
  compile_error?: string;
  full_compile_error?: string;
  runtime_error?: string;
  last_testcase?: string;
  expected_output?: string;
  code_output?: string;
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please wait a few seconds before trying again.");
    }
    if (text.trim().toLowerCase().startsWith("<!doctype html") || text.trim().toLowerCase().startsWith("<html")) {
      let title = "LeetCode Response";
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      const vscode = require("vscode");
      vscode.workspace
        .openTextDocument({ content: text, language: "html" })
        .then((doc: any) => vscode.window.showTextDocument(doc));

      throw new Error(`The response has been opened in the editor.`);
    }
    throw new Error(
      `LeetCode returned a non-JSON response (Status: ${response.status}): ${text}`
    );
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
