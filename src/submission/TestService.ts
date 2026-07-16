import { readJson, delay } from "./SubmitService";

interface TestParams {
  titleSlug: string;
  questionId: string;
  langSlug: string;
  code: string;
  dataInput: string;
  session: string;
  csrf: string;
}

export interface TestResult {
  interpretId: string;
  state?: string;
  statusMsg?: string;
  runtime?: string;
  memory?: string;
  totalCorrect?: number;
  totalTestcases?: number;
  compileError?: string;
  runtimeError?: string;
  codeAnswer?: string[];
  expectedCodeAnswer?: string[];
  correctAnswer?: boolean;
}

const BASE_URL = "https://leetcode.com";
const USER_AGENT = "Mozilla/5.0 Leet-VS-Code";
const MAX_POLL_ATTEMPTS = 30;
const POLL_DELAY_MS = 1000;

export class TestService {
  async test(params: TestParams): Promise<TestResult> {
    const response = await fetch(
      `${BASE_URL}/problems/${params.titleSlug}/interpret_solution/`,
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
          data_input: params.dataInput,
        }),
      }
    );

    const body = await readJson<{ interpret_id?: string; interpret_expected_id?: string; error?: string }>(response);
    const interpretId = body.interpret_id || body.interpret_expected_id;
    if (!response.ok || !interpretId) {
      throw new Error(
        body.error || `LeetCode interpret failed with HTTP ${response.status}`
      );
    }

    return this.pollResult(params, interpretId);
  }

  private async pollResult(
    params: TestParams,
    interpretId: string
  ): Promise<TestResult> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await delay(POLL_DELAY_MS);

      const response = await fetch(
        `${BASE_URL}/submissions/detail/${interpretId}/check/`,
        {
          method: "GET",
          headers: this.getHeaders(
            params,
            `${BASE_URL}/submissions/detail/${interpretId}/`
          ),
        }
      );
      const body = await readJson<any>(response);
      if (!response.ok) {
        throw new Error(
          `LeetCode status check failed with HTTP ${response.status}`
        );
      }

      if (body.state !== "PENDING" && body.state !== "STARTED") {
        return {
          interpretId,
          state: body.state,
          statusMsg: body.status_msg,
          runtime: body.status_runtime,
          memory: body.status_memory,
          totalCorrect: body.total_correct,
          totalTestcases: body.total_testcases,
          compileError: body.compile_error || body.full_compile_error,
          runtimeError: body.runtime_error,
          codeAnswer: body.code_answer,
          expectedCodeAnswer: body.expected_code_answer,
          correctAnswer: body.correct_answer,
        };
      }
    }

    return { interpretId, state: "PENDING", statusMsg: "Pending" };
  }

  private getHeaders(
    params: TestParams,
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
