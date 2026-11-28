---
scope: who uses Request Indexing today, measured from production on 2026-11-28
feeds: MARKETING.md (audience, channels, cues), VISION.md (who it is for)
snapshot: 2026-11-28. Every figure is dated. Rerun the appendix queries before you quote a figure.
privacy: aggregates only. No email address, email domain, name, or Site hostname appears here.
---

# Customer evidence, 2026-11-28

Follow-up snapshot 11 days after [the 2026-11-17 baseline](2026-11-17-customer-evidence.md).
Figures are status. They rot. Rerun the queries in the 2026-11-17 appendix before reusing one.

---

## Summary

1. **An onboarding Provisioning bug caused 0% Site activation since 2026-11-22.** Every user who connected Google between 2026-11-22 and 2026-11-28 (6 of 6) held 1 to 8 verified `siteOwner` properties in Search Console, yet all 6 completed onboarding with `sites: skipped`. `propertyPickerBlocksConnect` treated `USER_PROVISIONING` as blocked and showed "Skip and connect it later" permanently without polling.
2. **Read-only Google scope improved Connect Google before Agent setup moved first.** Connect Google rose from 52% (Oct 19 to Nov 16, 34 of 66) to 69% (Nov 17 to Nov 23, 9 of 13) after #431, then dropped to 43% (3 of 7) from Nov 24 to Nov 28 after Agent setup became Step 1. Sample is small (`n=7`).
3. **Zero agent adoption from Request Indexing signups.** Across all 161 Request Indexing accounts linked to gscdump, 1 imported April account called MCP once (0.6%). Zero open-signup accounts hold an `agent_entries` row, MCP call, or CLI session on gscdump, including every signup since 2026-11-24.
4. **ChatGPT is the #2 external signup source.** Across 28 attributed signups (up from 11), Google Search brought 13 (46%), Direct 9 (32%), and ChatGPT (`utm:chatgpt.com`) 4 (14%), ahead of Bing (2), DuckDuckGo (1), and GitHub (1).
5. **Custom-domain signups activate at 1.6x consumer signups.** Across 180 open-signup accounts, 91% (163) use consumer email and 9% (17) use a business or custom domain. Custom-domain accounts connect a Site at 47% (8 of 17) vs 29% (48 of 163) for consumer email.
6. **IndexNow verification drops sharply.** Across Request Indexing accounts in gscdump, 7 started an IndexNow connection, 1 verified (4 failed with `key-file-unavailable`, 2 never verified), 0 enabled automatic sending, and 0 succeeded in submitting URLs.
7. **Evidence views remain 0.** `page_evidence_viewed`, `first_report_evidence_viewed`, `indexing_investigations`, and `feedback` each hold 0 rows.

---

## Cohort funnel (open signup, founder excluded)

| Cohort | Signed up | Connected Google | Connected a Site | Finished setup | Evidence viewed |
|---|---:|---:|---:|---:|---:|
| 2026-09-16 to 2026-10-18 | 94 | 60 (64%) | 45 (48%) | 43 (46%) | 0 |
| 2026-10-19 to 2026-11-16 | 66 | 34 (52%) | 18 (27%) | 18 (27%) | 0 |
| 2026-11-17 to 2026-11-23 | 13 | 9 (69%) | 3 (23%) | 3 (23%) | 0 |
| 2026-11-24 to 2026-11-28 | 7 | 3 (43%) | 0 (0%) | 0 (0%) | 0 |

**Sites per open-signup account with a linked Site:** 1 Site: 45 (80%), 2 Sites: 8 (14%), 3 Sites: 3 (5%).

---

## Attribution (28 captured signups)

| Source | Landing | Signups | Connected Google | Connected a Site |
|---|---|---:|---:|---:|
| Google Search (`referral:google.com`) | `/` | 11 | 7 | 0 |
| Direct | `/pro/onboarding` | 4 | 2 | 1 |
| Direct | `/` | 3 | 2 | 1 |
| ChatGPT (`utm:chatgpt.com`) | `/` | 3 | 1 | 0 |
| Bing (`referral:bing.com`) | `/` | 2 | 1 | 0 |
| Google Search (`referral:google.com`) | `/tools` | 2 | 1 | 0 |
| Direct | `/pro/dashboard` | 1 | 1 | 1 |
| Direct | `/tools` | 1 | 1 | 0 |
| DuckDuckGo | `/` | 1 | 0 | 0 |
| GitHub | `/` | 1 | 1 | 0 |
| ChatGPT (`utm:chatgpt.com`) | `/tools` | 1 | 0 | 0 |

---

## Free tools, survey, and search demand

- **Free tools (`dataforseo_requests`):** 222 distinct IP hashes total; 220 used a tool on 1 day only (99.1%). Bulk-check drives most spend (about 1.80 to 2.00 USD per week recently).
- **About you:** 1 completed answer (`solo`, `6-20` sites, `basics` SEO, intents: `new-pages`, `why-not`, `many-sites`), 1 closed empty. Note: `ONBOARDING_ROLES` in `@nuxtseo/design-system` offers `Solo developer` as the only solo choice, with no `Site or business owner` option.
- **Search Console (2026-10-28 to 2026-11-26 vs previous 30 days):** 219 clicks (+8% from 203), 11,820 impressions (-31% from 17,116), CTR 1.85% (up from 1.19%), mean position 10.2 (up from 13.3). Top queries remain submission intent ("request indexing", "google search console request indexing", "free indexing tool").
