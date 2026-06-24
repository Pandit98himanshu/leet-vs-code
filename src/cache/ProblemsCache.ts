import * as fs from "fs";
import * as path from "path";
import type { ProblemList } from "leetcode-query";
import { getProblemsCacheDir } from "../paths";

type ProblemSummary = ProblemList["questions"][number];

interface CacheEntry {
  timestamp: number;
  problems: ProblemSummary[];
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Disk-based cache for LeetCode problems.
 * Stores cached problem lists as JSON files under rootDir/.cache/problems/.
 */
export class ProblemsCache {
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private get cacheDir(): string {
    return getProblemsCacheDir();
  }

  /**
   * Read cached problems for a given difficulty key.
   * Returns undefined if no cache exists or it has expired.
   */
  get(difficulty: string): ProblemSummary[] | undefined {
    const filePath = this.getCachePath(difficulty);

    try {
      if (!fs.existsSync(filePath)) {
        return undefined;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: CacheEntry = JSON.parse(raw);

      if (Date.now() - entry.timestamp > this.ttlMs) {
        // Cache expired — remove stale file
        this.delete(difficulty);
        return undefined;
      }

      return entry.problems;
    } catch {
      // Corrupted cache file — remove it silently
      this.delete(difficulty);
      return undefined;
    }
  }

  /**
   * Write problems to the disk cache for a given difficulty key.
   */
  set(difficulty: string, problems: ProblemSummary[]): void {
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });

      const entry: CacheEntry = {
        timestamp: Date.now(),
        problems,
      };

      fs.writeFileSync(
        this.getCachePath(difficulty),
        JSON.stringify(entry),
        "utf-8"
      );
    } catch {
      // Best-effort: caching failures should not break the extension
    }
  }

  /**
   * Remove a cached difficulty file.
   */
  delete(difficulty: string): void {
    try {
      const filePath = this.getCachePath(difficulty);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Remove all cached problem files.
   */
  clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private getCachePath(difficulty: string): string {
    const safeKey = difficulty.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return path.join(this.cacheDir, `${safeKey}.json`);
  }
}
