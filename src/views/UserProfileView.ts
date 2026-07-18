export interface UserProfile {
  allQuestionsCount: { difficulty: string; count: number }[];
  matchedUser: {
    username: string;
    profile: {
      realName: string;
      userAvatar: string;
      countryName: string | null;
      company: string | null;
      school: string | null;
      aboutMe: string;
      ranking: number;
      reputation: number;
      skillTags: string[];
    };
    submitStats: {
      acSubmissionNum: { difficulty: string; count: number; submissions: number }[];
      totalSubmissionNum: { difficulty: string; count: number; submissions: number }[];
    };
    badges: { displayName: string; icon: string }[];
    activeBadge: { displayName: string; icon: string } | null;
  } | null;
  recentSubmissionList: {
    title: string;
    titleSlug: string;
    timestamp: string;
    statusDisplay: string;
    lang: string;
  }[] | null;
}

export interface ContestInfo {
  userContestRanking: {
    attendedContestsCount: number;
    rating: number;
    globalRanking: number;
    totalParticipants: number;
    topPercentage: number;
    badge: { name: string } | null;
  } | null;
  userContestRankingHistory: {
    attended: boolean;
    rating: number;
    ranking: number;
    problemsSolved: number;
    totalProblems: number;
    contest: { title: string; startTime: number };
  }[];
}

export function getUserProfileHtml(profile: UserProfile, contestInfo: ContestInfo): string {
  const user = profile.matchedUser!;
  const p = user.profile;
  const stats = user.submitStats;

  const totalSolved =
    stats.acSubmissionNum.find((s) => s.difficulty === "All")?.count ?? 0;
  const totalProblems =
    profile.allQuestionsCount.find((s) => s.difficulty === "All")?.count ?? 0;
  const easySolved =
    stats.acSubmissionNum.find((s) => s.difficulty === "Easy")?.count ?? 0;
  const mediumSolved =
    stats.acSubmissionNum.find((s) => s.difficulty === "Medium")?.count ?? 0;
  const hardSolved =
    stats.acSubmissionNum.find((s) => s.difficulty === "Hard")?.count ?? 0;
  const easyTotal =
    profile.allQuestionsCount.find((s) => s.difficulty === "Easy")?.count ?? 0;
  const mediumTotal =
    profile.allQuestionsCount.find((s) => s.difficulty === "Medium")?.count ?? 0;
  const hardTotal =
    profile.allQuestionsCount.find((s) => s.difficulty === "Hard")?.count ?? 0;

  const progressPct =
    totalProblems > 0
      ? Math.round((totalSolved / totalProblems) * 100)
      : 0;

  const cr = contestInfo.userContestRanking;
  const contestHistory = (contestInfo.userContestRankingHistory ?? [])
    .filter((h) => h.attended)
    .slice(-10)
    .reverse();

  const recentSubs = profile.recentSubmissionList ?? [];

  const contestHistoryRows = contestHistory.length
    ? contestHistory
      .map((h) => {
        const date = new Date(h.contest.startTime * 1000).toLocaleDateString();
        return `<tr>
            <td>${escapeHtml(h.contest.title)}</td>
            <td>${date}</td>
            <td>${h.ranking.toLocaleString()}</td>
            <td>${h.problemsSolved}/${h.totalProblems}</td>
            <td>${Math.round(h.rating)}</td>
          </tr>`;
      })
      .join("")
    : '<tr><td colspan="5" style="text-align:center;opacity:0.5">No contest history</td></tr>';

  const recentSubsRows = recentSubs.length
    ? recentSubs
      .map((s) => {
        const date = new Date(
          parseInt(s.timestamp) * 1000
        ).toLocaleDateString();
        const icon =
          s.statusDisplay === "Accepted" ? "✅" : "❌";
        return `<tr>
            <td>${icon} ${escapeHtml(s.title)}</td>
            <td>${escapeHtml(s.statusDisplay)}</td>
            <td>${escapeHtml(s.lang)}</td>
            <td>${date}</td>
          </tr>`;
      })
      .join("")
    : '<tr><td colspan="4" style="text-align:center;opacity:0.5">No recent submissions</td></tr>';

  const badgesHtml = user.badges.length
    ? user.badges
      .map(
        (b) =>
          `<span class="badge-item" title="${escapeHtml(b.displayName)}">🏅 ${escapeHtml(b.displayName)}</span>`
      )
      .join("")
    : '<span class="muted">No badges</span>';

  const skillsHtml = p.skillTags?.length
    ? p.skillTags.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")
    : '<span class="muted">None listed</span>';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>@${escapeHtml(user.username)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    h2 { font-size: 0.9em; font-weight: 600; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
    .header { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 24px; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid var(--vscode-widget-border, #444); flex-shrink: 0; }
    .avatar-placeholder { width: 72px; height: 72px; border-radius: 50%; background: var(--vscode-badge-background); display: flex; align-items: center; justify-content: center; font-size: 2em; flex-shrink: 0; }
    .user-info { flex: 1; }
    .username { font-size: 1.4em; font-weight: 700; }
    .realname { opacity: 0.7; font-size: 0.95em; margin-top: 2px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .chip { padding: 2px 8px; border-radius: 4px; font-size: 0.78em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .divider { border: none; border-top: 1px solid var(--vscode-widget-border, #333); margin: 20px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat-card {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-widget-border, #333);
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .stat-card .value { font-size: 1.8em; font-weight: 700; }
    .stat-card .label { font-size: 0.78em; opacity: 0.65; margin-top: 4px; }
    .progress-bar { background: var(--vscode-progressBar-background, #333); border-radius: 99px; height: 8px; overflow: hidden; margin: 8px 0; }
    .progress-fill { height: 100%; border-radius: 99px; background: var(--vscode-textLink-foreground); transition: width 0.4s ease; }
    .diff-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .diff-item { flex: 1; min-width: 100px; background: var(--vscode-textBlockQuote-background); border-radius: 6px; padding: 8px 12px; border: 1px solid var(--vscode-widget-border, #333); }
    .diff-item .d-count { font-size: 1.2em; font-weight: 700; }
    .diff-item .d-label { font-size: 0.75em; opacity: 0.65; }
    .easy { border-top: 3px solid #00b8a3; }
    .medium { border-top: 3px solid #ffc01e; }
    .hard { border-top: 3px solid #ff375f; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th { text-align: left; padding: 6px 10px; opacity: 0.6; font-weight: 500; border-bottom: 1px solid var(--vscode-widget-border, #333); font-size: 0.85em; }
    td { padding: 6px 10px; border-bottom: 1px solid var(--vscode-widget-border, #22222230); }
    tr:last-child td { border-bottom: none; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.78em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); margin: 2px; }
    .badge-item { display: inline-block; margin: 2px 4px; font-size: 0.85em; }
    .muted { opacity: 0.5; font-style: italic; }
    .about { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textLink-foreground); border-radius: 0 6px 6px 0; padding: 10px 14px; margin-bottom: 4px; font-size: 0.9em; line-height: 1.6; }
  </style>
</head>
<body>

  <div class="header">
    <div class="avatar-placeholder">👤</div>
    <div class="user-info">
      <div class="username">@${escapeHtml(user.username)}
        <a href="https://leetcode.com/${escapeHtml(user.username)}/" title="Open on Leetcode"">↗</a>
      </div>
      ${p.realName ? `<div class="realname">${escapeHtml(p.realName)}</div>` : ""}
      <div class="meta-row">
        ${p.countryName ? `<span class="chip">📍 ${escapeHtml(p.countryName)}</span>` : ""}
        ${p.company ? `<span class="chip">🏢 ${escapeHtml(p.company)}</span>` : ""}
        ${p.school ? `<span class="chip">🎓 ${escapeHtml(p.school)}</span>` : ""}
        <span class="chip">🏆 Rank #${p.ranking.toLocaleString()}</span>
        <span class="chip">⭐ Rep ${p.reputation.toLocaleString()}</span>
      </div>
    </div>
  </div>

  ${p.aboutMe
        ? `<div class="about">${escapeHtml(p.aboutMe)}</div><hr class="divider" />`
        : ""
      }

  <h2>Problem Solving Stats</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="value">${totalSolved}</div>
      <div class="label">Problems Solved</div>
    </div>
    <div class="stat-card">
      <div class="value">${progressPct}%</div>
      <div class="label">of ${totalProblems} total</div>
    </div>
    ${cr
        ? `<div class="stat-card">
            <div class="value">${Math.round(cr.rating)}</div>
            <div class="label">Contest Rating</div>
          </div>
          <div class="stat-card">
            <div class="value">#${cr.globalRanking.toLocaleString()}</div>
            <div class="label">Global Rank (top ${cr.topPercentage.toFixed(1)}%)</div>
          </div>`
        : ""
      }
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width:${progressPct}%"></div>
  </div>

  <div class="diff-row">
    <div class="diff-item easy">
      <div class="d-count">${easySolved} <small style="opacity:0.5">/ ${easyTotal}</small></div>
      <div class="d-label">Easy</div>
    </div>
    <div class="diff-item medium">
      <div class="d-count">${mediumSolved} <small style="opacity:0.5">/ ${mediumTotal}</small></div>
      <div class="d-label">Medium</div>
    </div>
    <div class="diff-item hard">
      <div class="d-count">${hardSolved} <small style="opacity:0.5">/ ${hardTotal}</small></div>
      <div class="d-label">Hard</div>
    </div>
  </div>

  <hr class="divider" />

  <h2>Recent Submissions (public, max 20)</h2>
  <table>
    <thead><tr><th>Problem</th><th>Status</th><th>Language</th><th>Date</th></tr></thead>
    <tbody>${recentSubsRows}</tbody>
  </table>

  ${cr
        ? `<hr class="divider" />
  <h2>Contest History (last 10)</h2>
  <table>
    <thead><tr><th>Contest</th><th>Date</th><th>Rank</th><th>Solved</th><th>Rating</th></tr></thead>
    <tbody>${contestHistoryRows}</tbody>
  </table>`
        : ""
      }

  <hr class="divider" />

  <h2>Badges</h2>
  <div>${badgesHtml}</div>

  <hr class="divider" />

  <h2>Skills</h2>
  <div>${skillsHtml}</div>

</body>
</html>`;
}

export function escapeHtml(str: string | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
