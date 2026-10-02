# <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" width="32" height="32" alt="LeetCode Logo" style="vertical-align: middle; margin-right: 8px;" /> Leet VS Code

A lightweight, fully-featured LeetCode extension for VS Code that brings the complete competitive programming experience directly into your editor with a native, distraction-free aesthetic.

## Features

- **Native Problem View:** Read problem descriptions, stats, and examples.
- **Interactive Hints:** Hints are hidden in dropdowns so you can view them only when you need them.
- **Similar Questions:** Instantly hop between related problems.
- **Search Problems:** Quickly search and find problems by name or ID.
- **Company Tags:** View company tags to see which companies ask specific problems.
- **Write & Test Code:** Open starter code snippet in your preferred language.
- **Submit Solutions:** Submit your active solution file to LeetCode and see real-time result feedback in LeetCode console.
- **Results Panel:** View detailed output of your test cases and submissions in a dedicated results panel.
- **View Submissions:** Browse a QuickPick list of your past submissions for any problem (showing status, runtime, memory).
- **User Profiles:** Check any user's profile.

## Usage

Once you set your LeetCode session in the extension, you can browse problems, open them in the native webview, and start coding!

## How to Login

To use this extension, you need to authenticate by providing your `LEETCODE_SESSION` cookie. Here is how you can retrieve it from your preferred browser:

<details>
<summary>Google Chrome / Microsoft Edge</summary>

1. Log into [LeetCode](https://leetcode.com).
2. Right-click anywhere on the page and select **Inspect**.
3. Navigate to the **Application** tab (you may need to click the `>>` arrows if it's hidden).
4. In the left sidebar, expand **Cookies** and click on `https://leetcode.com`.
5. Find the cookie named `LEETCODE_SESSION` and copy its `Value`.
</details>

<details>
<summary>Mozilla Firefox</summary>

1. Log into [LeetCode](https://leetcode.com).
2. Right-click anywhere on the page and select **Inspect**.
3. Navigate to the **Storage** tab.
4. In the left sidebar, expand **Cookies** and click on `https://leetcode.com`.
5. Find the cookie named `LEETCODE_SESSION` and copy its `Value`.
</details>

<details>
<summary>Safari</summary>

1. Log into [LeetCode](https://leetcode.com).
2. Right-click anywhere on the page and select **Inspect Element** (ensure the "Show Develop menu in menu bar" setting is enabled in Safari's Advanced preferences).
3. Navigate to the **Storage** tab.
4. In the left sidebar, select **Cookies**.
5. Find the cookie named `LEETCODE_SESSION` and copy its `Value`.
</details>

Once you have copied the cookie value, open the VS Code Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`), search for **LeetCode: Set Session**, and paste the token to log in.
