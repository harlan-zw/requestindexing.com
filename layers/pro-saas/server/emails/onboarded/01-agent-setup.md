---
subject: "Ask your coding agent why a page is not indexed"
delayHours: 72
---

Hi {firstName},

You can ask a coding agent about your indexing record. Claude Code, Codex, and Cursor all work.

Request Indexing runs on gscdump, an open engine for Search Console data. Your agent reads gscdump with an API key from your Request Indexing account.

Agent setup takes one prompt:

1. Open the Developers page: {DEVELOPERS_URL}
2. Click Copy agent setup prompt.
3. Paste the prompt into your agent.

If you have not connected Search Console, the page asks you to do that first.

The first copy creates an API key named Agent setup. The agent installs the CLI and the skill. Then it summarises the stored URL Inspection verdicts for your pages.

After that, ask in your own words. Try this one: "Which of my pages are not indexed, and what reason does Google give?"

If your agent has no terminal, use the MCP tab on the same page. It has the steps for Claude.ai and ChatGPT.

To stop the agent, revoke its key on the Developers page.

If a step fails, reply with the error. I'll help you fix it.

Harlan
