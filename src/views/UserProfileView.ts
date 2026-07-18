import { escapeHtml } from "../utils/html";

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

export function getUserProfileHtml(profile: UserProfile, contestInfo: ContestInfo, styleUri: string): string {
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
  <link rel="stylesheet" href="${styleUri}" />
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
