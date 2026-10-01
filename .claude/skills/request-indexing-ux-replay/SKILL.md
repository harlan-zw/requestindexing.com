---
name: request-indexing-ux-replay
description: Replay Request Indexing onboarding as a new user on the web dashboard and through a coding agent, capture every page and state, check the onboarding mail, and fix material defects. Use for launch rehearsals, first-user tests, or repeat onboarding checks.
---

# Request Indexing UX replay

Ported from gscdump's `gscdump-ux-replay` and nuxtseo.com's `agent-dogfood`.
This app hosts no CLI, MCP server, or agent skill. The agent path is gscdump's CLI, skill, and MCP server, signed in with a key this app issues. `VISION.md` and `docs/arch/README.md` say why.

Run the product as a new user. Record what they see before you read the code.
A command that exits zero does not pass the test. A useful result passes it.

## Start each replay

1. Read `AGENTS.md`, `VISION.md`, `GLOSSARY.md`, and `COPY.md`. Read `DESIGN.md` before a UI fix.
2. Read `layers/pro-gsc/shared/developer-setup.ts`. It holds the agent setup prompt and the Developers page steps.
3. Record the production commit from `gh run list --workflow "Deploy to Cloudflare" --branch main --limit 1`.
4. Record the gscdump CLI version from `pnpm dlx @gscdump/cli@latest --version`.
5. Confirm 4 facts with the user: the test Google identity, the browser profile signed in to it, the inbox that gets its mail, and whether another replay uses that identity now.
6. Make a dated note `~/notes/requestindexing-ux-replay-YYYY-MM-DD.md`. Put screenshots beside it. Put scratch output in `~/scratch/ri-replay/`.
7. Never record secrets, OAuth codes, raw API keys, or private query data.

## The test identity

One Google account is one gscdump user. gscdump.com signs in a partner-created user as the same user, so both products share it.
A deletion on either side changes the other.

- Run one replay per identity at a time. If a gscdump replay uses the identity, wait until it ends.
- Between attempts, delete the account on the Account page. The deletion is part of the path under test.
- After a deletion, confirm that sign-in starts a new signup and onboarding. If old Sites or keys come back, record a finding.

## Persona A: web dashboard

Goal: a new person signs up, completes onboarding, connects a Site, and learns whether a page is indexed and why.

1. Start signed out at `https://requestindexing.com/`. Capture the landing page at desktop width and at 390px.
2. Sign up with Google. Record each redirect and each consent screen.
3. Complete onboarding. Capture each step. Record any step that asks for a choice the person cannot make yet.
4. Connect a Site. Use the least sensitive Site the identity owns. Capture the Search Console property list.
5. Watch the first sync from queued to complete. Sample the early, middle, and final states. Compare the visible progress with gscdump lifecycle data when you can read it.
6. Open Overview, Indexing, Sitemaps, and one URL. Reload each page once to catch first-render errors. Check the sidebar.
7. Answer the job. Pick one URL that is not indexed. Capture whether the product says why and what to do.
8. If the Site allows it, Submit one eligible URL. Record what the UI claims. A Submission is a notification Google accepted. It never proves that the page is indexed.
9. Delete the account. Capture the confirmation and the signed-out result.

## Persona B: agent

Goal: the same person gets an indexing answer inside a coding agent, with no docs.

1. Sign in, open Developers, and click **Copy agent setup prompt**. Capture the page before and after.
2. Check that every command in the copied prompt exists in the current CLI. Use `--help`, never memory.
3. Give the prompt to a sub-agent with an isolated `HOME` under `~/scratch/ri-replay/agent-home`. The sub-agent follows the prompt only. It does not read this repository or the gscdump source.
4. Record each command, its exit code, and its duration. The run passes only when it ends with an indexing summary for a connected Site.
5. Check the MCP path once. Add `https://gscdump.com/mcp` with the key in the `x-api-key` header, list the tools, and call one read tool.
6. Check the Claude.ai connector path once. It signs in at gscdump.com with the same Google account. Confirm that it shows the same Sites. If it shows a waitlist or no Sites, record a finding.
7. Revoke the key on Developers. Confirm that the CLI and MCP now fail with a clear error.

## Mail

Check the inbox of the identity after signup, after the first sync, and at each onboarding email step.

- Record the sender, subject, time after signup, and every link target.
- Open each link signed out and signed in.
- Each onboarding email has an unsubscribe link. Click it, capture the result page, and confirm that the next step does not send.
- If a test needs an email sooner than its schedule, ask before you change a schedule in production.

## Capture evidence

For each transition, log the time, persona, action, expected result, actual result, URL or command, and evidence file.
Capture loading states, loaded states, empty states, and errors. Capture desktop width and 390px when layout matters.

Use `dev-browser` with a unique page name for each persona. Close every page at the end. Never run `dev-browser stop`.
If `$DISPLAY` is empty, pass `--headless`.
Google refuses sign-in in a new automated profile. For steps that need Google, connect to the user's own Chrome with `dev-browser --connect`.
If you cannot connect, ask the user for the one browser action and continue the other checks.

## Orchestrate, review, fix

- The orchestrator keeps the note and the findings table. Each sub-agent walks one persona and returns screenshots and a transition log.
- A reviewer reads each screenshot before the next attempt. It asks whether the issue changes a choice, hides progress, blocks a result, or costs real time. Skip polish with no concrete effect.
- For a material defect, record the smallest failing path. Fix the cause in a task-owned `wt` worktree. Add a behaviour test when the fix changes logic. Open a PR and follow `AGENTS.md`.
- A UI change to a signed-in route needs a deploy preview. No authenticated page renders locally without credentials.
- A defect in the gscdump CLI, skill, MCP server, or engine gets a PR in the gscdump repository. Never add a workaround here.
- Keep operations failures apart from product UX. Do not turn the replay into a backlog sweep.
- After a fix deploys, run the failing step again on production. Keep the screenshots from before and after.

## Bring in the user's run

If the user walks the path too, add their observations as they arrive.
After the fixes are live, give the user the note link and this prompt:

> Start at requestindexing.com in your normal browser. Tell me where you paused, guessed, waited, or saw a result you did not trust. Send rough notes or screenshots.

Add a `Your walkthrough` section to the same note. Keep the user's words beside the agent observation.
For each difference, record whether it reproduces, its cause, and the fix or the reason to skip. Never claim that the user's pass happened.

## Report

The note holds a short result, a Mermaid path diagram, a timed workflow table, screenshots with relative links, and a findings table with evidence and disposition.

Give the user a three-line summary and `https://notes.localhost/notes/<note-name>`.
State end-to-end confidence from observed behaviour. Name each path that stays untested.
