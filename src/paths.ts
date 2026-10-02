import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

const DEFAULT_ROOT_DIR = path.join(os.homedir(), ".leetcode-md");

/**
 * Returns the user-configured root directory, or ~/.leetcode-md by default.
 */
export function getRootDir(): string {
  const configured = vscode.workspace
    .getConfiguration("leetcode-md")
    .get<string>("rootDir", "");
  return configured || DEFAULT_ROOT_DIR;
}

/** root_dir/solutions */
export function getSolutionsDir(): string {
  return path.join(getRootDir(), "solutions");
}

/** root_dir/.cache/problems */
export function getProblemsCacheDir(): string {
  return path.join(getRootDir(), ".cache", "problems");
}

/** root_dir/.cache/problems/search_index.json */
export function getProblemSearchCachePath(): string {
  return path.join(getProblemsCacheDir(), "search_index.json");
}