# n8n Workflow Documentation: `07_08_generateResume`

**Workflow ID:** `ASIIZzFPt96LmHbi`
**Status:** Active
**Purpose:** Receives a job application request via webhook, uses Claude (Anthropic) to generate a tailored, ATS-optimized resume and a personalized cover letter, formats both as richly-styled Google Docs, logs the application to a tracking spreadsheet, and returns the generated document links to the caller.

---

## Workflow Overview

```
Webhook → Take input ─┬─→ RESUME (Claude) ────────────┐→ Normalize Resume Output → Build Resume Document Template
                       │                                                                        ↓
                       │                                                          Create a document3 (Google Docs)
                       │                                                                        ↓
                       │                                                       Generate Google Docs Requests
                       │                                                                        ↓
                       │                                                            HTTP Request2 (batchUpdate)
                       │                                                                        ↓
                       │                                                                  Edit Fields ──┐
                       │                                                                                │
                       └─→ COVER LETTER (Claude) → Generate Cover Letter Docs Requests                  │
                                                              ↓                                          │
                                                  Create a document4 (Google Docs)                       │
                                                              ↓                                          │
                                                     HTTP Request3 (batchUpdate)                         │
                                                              ↓                                          │
                                                        Edit Fields2 ──┐                                 │
                                                                       ↓                                 ↓
                                                                    Merge1 ←───────────────────────────────
                                                                       ↓
                                                          Build Application Results
                                                                   ↙        ↘
                                                  Append row in sheet2   Respond to Webhook
```

Two parallel AI generation branches (resume + cover letter) run from the same input, each producing a formatted Google Doc, and their resulting URLs are merged back together before being logged and returned to the caller.

---

## 1. Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.webhook` |
| **Node ID** | `669c5614-a97b-4ff3-9f89-b14336241ec7` |
| **HTTP Method** | `POST` |
| **Path** | `/generateResume` |
| **Response Mode** | `responseNode` (final reply sent by **Respond to Webhook**) |
| **Allowed Origins** | `*` (open CORS) |

**Purpose:** Entry point for the workflow. Expects a request body containing job details (`company_name`, `job_title`, `job_description`, `job_url`, `time_posted`, `apply_url`, `company_url`, `seniority_level`, `salary_range`, `num_applicants`) plus `resumeContent` (the candidate's original resume text).

**Downstream:** → **Take input**

---

## 2. Take input

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `92fca482-5ea1-49b0-9143-509e18e0ea59` |
| **Code** | `return $input.all();` |

**Purpose:** A pass-through node that simply forwards all incoming items unchanged. It exists as a fan-out point in the graph, splitting execution into two parallel branches.

**Downstream:** → **RESUME** and → **COVER LETTER** (both run in parallel from this single node)

---

## 3. RESUME

| Property | Value |
|---|---|
| **Type** | `@n8n/n8n-nodes-langchain.anthropic` |
| **Node ID** | `0cfb9dc5-c399-4cf1-8cfa-7e0ef8ca1b98` |
| **Model** | `claude-opus-4-8` |
| **Max Tokens** | `30000` |
| **Credential** | Anthropic API (`HemantSir`) |

**Purpose:** Calls Claude with a detailed system prompt instructing it to act as an "expert resume writer and ATS optimization specialist." It rewrites the candidate's original resume (from `resumeContent`) to be tailored to the specific job, without fabricating any facts.

**Key Prompt Rules:**
- **Strict non-fabrication policy:** May not invent titles, employers, dates, metrics, education, or achievements.
- **Allowed transformations:** Rephrasing, reordering, keyword optimization from the job description, and skill categorization (3–6 logical, domain-appropriate categories).
- **Structure preservation:** Original section order/hierarchy and factual details (employer names, titles, dates) must be preserved exactly.
- **Strict JSON output:** Must return a single JSON object (no Markdown/commentary) matching an exact schema: `candidateName`, `contactInfo`, `credentialsLine`, `tagline`, `professionalSummary`, `skillCategories`, `experience`, `education`, `certifications`, `projects`, `additionalSections`.
- **Completeness constraints:** Enforces conciseness limits (e.g., professional summary ≤ 3–4 sentences, ≤4 bullets per role) specifically to avoid the response being truncated before the closing `}`.

**User Message:** Injects `company_name`, `job_title`, `job_description`, and `resumeContent` from the Webhook data into the prompt.

**Note:** The system prompt schema contains a duplicated `"contactInfo"` key (defined twice in the JSON schema shown to the model) — likely a copy-paste artifact; harmless since JSON parsers keep the last occurrence, but worth cleaning up for prompt clarity.

**Downstream:** → **Normalize Resume Output**

---

## 4. COVER LETTER

| Property | Value |
|---|---|
| **Type** | `@n8n/n8n-nodes-langchain.anthropic` |
| **Node ID** | `9a054369-4081-4531-b679-05b8cd4f4604` |
| **Model** | `claude-opus-4-8` |
| **Max Uses (option)** | `35000` |
| **Credential** | Anthropic API (`HemantSir`) |

**Purpose:** Calls Claude with a system prompt instructing it to act as an "expert career coach and cover letter writer," producing a truthful, personalized cover letter based solely on facts present in the resume.

**Key Prompt Rules:**
- **Absolute truthfulness rules:** No invented anecdotes, employers, dates, or achievements not evidenced in the resume.
- **Content requirements:** Must explicitly connect 2–4 real experiences to the job description's stated requirements, in a professional business-letter tone (opening hook, 1–2 body paragraphs, closing call to action).
- **Strict JSON output:** Must return a single JSON object matching schema: `candidateName`, `candidateContact` (email/phone/location), `date`, `companyName`, `jobTitle`, `salutation`, `openingParagraph`, `bodyParagraphs` (array), `closingParagraph`, `signOff`.

**User Message:** Injects `company_name`, `job_title`, `job_description`, and `resumeContent` from upstream/Webhook data into the prompt.

**Note:** This node's `options` field sets `maxUses: 35000` rather than `maxTokens` (unlike the RESUME node, which sets `maxTokens: 30000`). If `maxUses` isn't the intended token-limiting parameter for this node type, cover letters could be more prone to truncation — which is consistent with the fact that the downstream **Generate Cover Letter Docs Requests** node contains defensive JSON-repair logic specifically for truncated responses (see below), while the resume path does not.

**Downstream:** → **Generate Cover Letter Docs Requests**

---

## 5. Normalize Resume Output

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `ca138829-55fa-4649-8874-885a02ec0bf9` |
| **Language** | JavaScript (Code node) |

**Purpose:** Parses Claude's raw resume response, strips any accidental Markdown code fences, parses the JSON, and normalizes it against a canonical schema (filling in missing fields like `contactInfo` defaults). Handles multiple possible raw-text field locations (`content[0].text`, `output`, `text`, `data`) for resilience against API response shape differences.

**Output:** A single item containing `{ resumes: [...] }` — an array of normalized resume objects, ready for the frontend/document-building steps.

**Error Handling:** Throws a descriptive error if the response text is missing or fails to parse as JSON, including a snippet of the raw text for debugging.

**Downstream:** → **Build Resume Document Template**

---

## 6. Build Resume Document Template

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `125ea189-5af1-462d-917c-2d056545dc76` |
| **Language** | JavaScript (Code node) |

**Purpose:** Converts each normalized resume JSON object into an intermediate "paragraph" model describing a fully designed resume layout — a styled header banner (colored background, centered name/contact info), section headers with border/color styling, and formatted entries for summary, skills, experience, projects, education, certifications, and any additional sections.

**Key Design Details:**
- Defines brand constants: heading color `#1F4E79`, white text, `Calibri` body font, `Georgia` header font, and a 468pt content width for spacing calculations.
- Builds a header banner with the candidate's name (uppercase, bold, size 22), optional credentials line and tagline, and a centered contact line (`location • phone • email • linkedin`) with hyperlinks.
- Estimates text width to auto-calculate spacing for right-aligned date fields next to job/degree titles (`addTitleDateLine`).
- Groups skill categories, experience bullets, project details, education entries, certifications, and custom sections into styled paragraph blocks, using `keepWithNext`/`keepLinesTogether` flags to prevent awkward page breaks.

**Output:** One item per resume containing `resumeTemplate` (an array of paragraph definitions) and `candidateName`.

**Downstream:** → **Create a document3**

---

## 7. Create a document3

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.googleDocs` |
| **Node ID** | `e5c82ecb-8189-4e71-9813-e0a2d8cc351a` |
| **Folder ID** | *(empty/root)* |
| **Title** | `Resume {{ company_name }}` |
| **Credential** | Google Docs OAuth2 (`Hemant`) |

**Purpose:** Creates a new, empty Google Doc for the resume, named after the target company (e.g., "Resume Acme Corp"). Returns the new document's `id`, which downstream nodes use to populate content via the Docs API.

**Downstream:** → **Generate Google Docs Requests**

---

## 8. Generate Google Docs Requests

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `2ef8e22d-9b06-407e-8391-1e4644886255` |
| **Language** | JavaScript (Code node) |

**Purpose:** Converts the paragraph-based `resumeTemplate` from **Build Resume Document Template** into a valid Google Docs API `batchUpdate` `requests` array — the low-level instructions (`insertText`, `updateParagraphStyle`, `updateTextStyle`) needed to actually render the formatted resume inside the blank document.

**Key Logic:**
- Tracks a running character `currentIndex` to correctly position each `insertText` request as the document is built sequentially.
- Decodes HTML entities in text runs (e.g., `&amp;` → `&`).
- Converts hex colors (e.g., `#1F4E79`) to the RGB float format required by the Docs API.
- Applies paragraph-level styling: heading style, alignment, spacing before/after, line spacing, indentation, borders, shading, and page-break-avoidance flags (`keepWithNext`, `keepLinesTogether`).
- Applies run-level (character) styling: bold, italic, underline, font family, font size, color, and hyperlinks.
- Processes **all** items via `$('Build Resume Document Template').all()`, producing one requests array per resume.

**Downstream:** → **HTTP Request2**

---

## 9. HTTP Request2

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.httpRequest` |
| **Node ID** | `69560935-bd70-41b3-ac6d-a431e54e33ab` |
| **Method** | `POST` |
| **URL** | `https://docs.googleapis.com/v1/documents/{{ document3.id }}:batchUpdate` |
| **Auth** | Generic OAuth2 (`HemantSir`) |
| **Body** | `{ requests: $json.requests }` (JSON) |

**Purpose:** Sends the generated formatting/insert requests to the Google Docs API's `batchUpdate` endpoint, which writes and styles all the resume content into the previously created blank document in a single atomic call.

**Downstream:** → **Edit Fields**

---

## 10. Edit Fields

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.set` |
| **Node ID** | `4a78d8e4-c507-4c84-a9f5-7b63fe677918` |

**Purpose:** Constructs the final shareable URL for the completed resume document: `resumeUrl = "https://docs.google.com/document/d/" + Create a document3.id + "/edit"`.

**Downstream:** → **Merge1** (input 0)

---

## 11. Generate Cover Letter Docs Requests

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `0a1d5697-a500-4897-84a3-26fde8ec50dd` |
| **Language** | JavaScript (Code node) |

**Purpose:** Parses Claude's raw cover letter JSON response (with defensive cleanup and repair logic) and converts it directly into a Google Docs API `batchUpdate` `requests` array — combining parsing and document-request generation in one step (unlike the resume path, which splits this across two nodes).

**Key Logic:**
- **`cleanText`** — strips accidental Markdown code fences (```` ```json ```` / ```` ``` ````) that the model sometimes adds despite instructions not to.
- **`attemptRepair`** — a best-effort safety net for JSON truncated mid-response: balances unclosed quotes, trims trailing commas, and closes any unclosed `{`/`[` brackets using a stack. Throws a clear, actionable error (pointing to raising `max_tokens` on the COVER LETTER node) if repair still fails.
- **`buildRequestsForCoverLetter`** — builds a formatted letter layout: bold 16pt candidate name header, 10pt contact line (email/phone/location), date, company name, bolded "Re: Application for {job title}" line, salutation, opening/body/closing paragraphs (11pt, Times New Roman), sign-off, and candidate name — each as sequential `insertText` + `updateTextStyle` requests.
- Processes **all** input items in a loop, producing `requests`, `candidateName`, and `companyName` per item.

**Note:** The extensive repair logic here directly compensates for the COVER LETTER node's `maxUses: 35000` setting, which (per the code's own comments) may not be reliably preventing truncation the way `maxTokens` does on the RESUME node.

**Downstream:** → **Create a document4**

---

## 12. Create a document4

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.googleDocs` |
| **Node ID** | `0e05b0d1-c61a-4a26-8d91-0d8358f1bd10` |
| **Folder ID** | `default` |
| **Title** | `CoverLetter {{ company_name }}` |
| **Credential** | Google Docs OAuth2 (`Hemant`) |

**Purpose:** Creates a new, empty Google Doc for the cover letter, named after the target company (e.g., "CoverLetter Acme Corp"). Returns the document `id` used by the next step.

**Downstream:** → **HTTP Request3**

---

## 13. HTTP Request3

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.httpRequest` |
| **Node ID** | `38b831e2-f49d-483d-a018-ca2d3f054a0f` |
| **Method** | `POST` |
| **URL** | `https://docs.googleapis.com/v1/documents/{{ document4.id }}:batchUpdate` |
| **Auth** | Generic OAuth2 (`HemantSir`) |
| **Body** | `{ "requests": {{ requests from Generate Cover Letter Docs Requests }} }` (JSON) |

**Purpose:** Sends the cover letter's formatting/insert requests to the Google Docs API, writing the fully formatted cover letter content into the blank document created by **Create a document4**.

**Downstream:** → **Edit Fields2**

---

## 14. Edit Fields2

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.set` |
| **Node ID** | `2054f4c2-5cd7-4514-9fb4-fc9b1c3c7702` |

**Purpose:** Constructs the final shareable URL for the completed cover letter document: `coverUrl = "https://docs.google.com/document/d/" + Create a document4.id + "/edit"`.

**Downstream:** → **Merge1** (input 1)

---

## 15. Merge1

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.merge` |
| **Node ID** | `8d7933b1-6014-485f-895c-226c9a14b2a1` |
| **Mode** | `combine` |
| **Combine By** | `combineByPosition` |

**Purpose:** Merges the resume branch (input 0, from **Edit Fields**) and cover letter branch (input 1, from **Edit Fields2**) back into a single stream, pairing each resume item with its corresponding cover letter item by list position (index). This is the join point after the two parallel Claude-generation branches.

**Downstream:** → **Build Application Results**

---

## 16. Build Application Results

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `0aad56ac-ab36-4129-ab16-fb496d4eb826` |
| **Language** | JavaScript (Code node) |

**Purpose:** Combines each merged item's generated `resumeUrl`/`coverUrl` with the original job's `company_name` and `job_url` (looked up from the original **Webhook** data by matching index position), producing a clean results array intended for the frontend/API caller.

**Output Schema (per result):**
```json
{
  "ApplyLink": "...",
  "companyName": "...",
  "resumeUrl": "...",
  "coverLetterUrl": "..."
}
```
Wrapped as a single item: `{ results: [...] }`.

**Note:** Includes `console.log` debug statements (`input items`, `first item json`, per-index company name) — useful during development but should typically be removed or gated before production use, as they add noise to execution logs.

**Downstream:** → **Append row in sheet2** and → **Respond to Webhook** (both run in parallel)

---

## 17. Append row in sheet2

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.googleSheets` |
| **Node ID** | `50edd3a3-4988-4a4a-865f-f3e922662b00` |
| **Operation** | Append |
| **Spreadsheet** | "Job Description" (`1pCPX66mBEkaQhOya-SOuhM_bPWlmTbI5hKdX3Jrqn9A`) |
| **Sheet** | Sheet1 (`gid=0`) |
| **Credential** | Google Sheets OAuth2 (`Hemant`) |

**Purpose:** Logs the completed application as a new row in a tracking spreadsheet, recording:

| Column | Source |
|---|---|
| Job Post Link | Webhook `body.job_url` |
| Job Title | Webhook `body.job_title` |
| Posted At | Webhook `body.time_posted` |
| Application Link | Webhook `body.apply_url` |
| Company Name | Webhook `body.company_name` |
| Description | Webhook `body.job_description` |
| Salary | Webhook `body.salary_range` |
| Status | Hardcoded `"To-do"` |
| Company Website | Webhook `body.company_url` |
| Seniority Level | Webhook `body.seniority_level` |
| resumeUrl | `Merge1.resumeUrl` |
| coverLetterUrl | `Merge1.coverUrl` |
| Applicants | Webhook `body.num_applicants` |

**Note:** This node's `main` output connection array is empty (`[[]]`) — it is a terminal/dead-end node in the graph (its result is not consumed further), which is expected since its role is purely to log data as a side effect.

---

## 18. Respond to Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **Node ID** | `8ede3a8f-509a-4d11-8634-a0e2e10ab35d` |
| **Respond With** | JSON |
| **Response Body** | `{{ $('Build Application Results').item.json.results }}` |

**Purpose:** Sends the final HTTP response back to the original caller, returning the `results` array (application link, company name, resume URL, and cover letter URL) generated by **Build Application Results**.

---

## Data Flow Summary

| Stage | Node | Role |
|---|---|---|
| 1 | Webhook | Receives job + resume data via POST |
| 2 | Take input | Pass-through / fan-out point |
| 3a | RESUME | Claude generates ATS-optimized resume JSON |
| 3b | COVER LETTER | Claude generates personalized cover letter JSON |
| 4a | Normalize Resume Output | Parses/normalizes resume JSON |
| 4b | Generate Cover Letter Docs Requests | Parses/repairs cover letter JSON, builds Docs API requests |
| 5a | Build Resume Document Template | Builds styled paragraph model for resume |
| 6a | Create a document3 | Creates blank Google Doc for resume |
| 6b | Create a document4 | Creates blank Google Doc for cover letter |
| 7a | Generate Google Docs Requests | Converts resume template → Docs API requests |
| 8a | HTTP Request2 | Writes formatted resume content into doc |
| 8b | HTTP Request3 | Writes formatted cover letter content into doc |
| 9a | Edit Fields | Builds final resume doc URL |
| 9b | Edit Fields2 | Builds final cover letter doc URL |
| 10 | Merge1 | Joins resume + cover letter branches by position |
| 11 | Build Application Results | Assembles final result objects per job |
| 12a | Append row in sheet2 | Logs application to tracking spreadsheet |
| 12b | Respond to Webhook | Returns results JSON to caller |

## Observations & Potential Improvements

1. **Token-limit inconsistency:** The RESUME node sets `maxTokens: 30000`, while the COVER LETTER node sets `maxUses: 35000` instead — likely not the correct parameter for limiting output length on that node type. This is probably why extensive JSON-repair logic exists only on the cover letter path; aligning both nodes to use the same token-limiting option would likely reduce truncation failures at the source.
2. **Debug logging left in production code:** **Build Application Results** contains `console.log` statements that should be removed or feature-flagged for a production deployment.
3. **Open CORS policy:** `allowedOrigins: "*"` on the Webhook permits calls from any origin; consider restricting this in production.
4. **Duplicate schema key:** The RESUME node's system prompt defines `"contactInfo"` twice in its JSON schema block — a harmless but confusing copy-paste artifact worth cleaning up.
5. **Position-based merge risk:** **Merge1** uses `combineByPosition`, which assumes the resume and cover letter branches always produce items in the same order and count. If either Claude call fails, is retried, or returns a different number of items for any item in a batch, the merge could silently pair mismatched resumes and cover letters. A key-based merge (e.g., on `company_name` + `job_title`) would be more robust for multi-job batches.
6. **Hardcoded status value:** The `Status` column in the tracking sheet is always set to `"To-do"`; this is fine for new entries but means the sheet can't be updated in place via this workflow if status needs to change later (e.g., to "Applied").
7. **Folder ID inconsistency:** **Create a document3** uses an empty `folderId` (`"="`), while **Create a document4** explicitly uses `"default"`. Both likely resolve to the same root/default location, but standardizing the value would improve readability.
