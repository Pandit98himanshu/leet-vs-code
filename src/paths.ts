import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

const DEFAULT_ROOT_DIR = path.join(os.homedir(), ".leetvscode");

/**
 * Returns the user-configured root directory, or ~/.leetvscode by default.
 */
export function getRootDir(): string {
  const configured = vscode.workspace
    .getConfiguration("leetvscode")
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

/** root_dir/.cache/problems/all.json */
export function getProblemSearchCachePath(): string {
  return path.join(getProblemsCacheDir(), "all.json");
}