# n8n Workflow Documentation: `SearchJobs`

**Workflow ID:** `e7OVpDHVFww7rf1o`
**Status:** Active
**Purpose:** Receives a job-search request via webhook, queries either LinkedIn or Indeed (via Apify scraper actors) based on the requested source, normalizes the results into a consistent schema, attaches the candidate's resume content, and returns the job list as a JSON response.

---

## Workflow Overview

```
Webhook → Code in JavaScript → Switch ─┬─→ LinkedIn Job → Build LinkedIn Company Array ─┐
                                        └─→ Indeed Job   → Build Indeed Company Array   ─┴─→ Respond to Webhook
```

---

## 1. Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.webhook` |
| **Node ID** | `3205745b-01aa-4c13-b8e6-b2e65211b279` |
| **HTTP Method** | `POST` |
| **Path** | `/searchJobs` |
| **Response Mode** | `responseNode` (a downstream Respond to Webhook node returns the reply) |
| **Allowed Origins** | `*` (CORS open to all origins) |
| **Error Handling** | `continueErrorOutput` — routes to a second output branch on failure instead of halting the workflow |

**Purpose:** Entry point of the workflow. External clients (e.g., a front-end application) POST a job search request to this endpoint. The expected request body includes fields such as `jobTitle`, `jobSource`, `location`, `NoOfJobs`, `jobType`, `workPlace`, and `resumeContent`.

**Downstream:** Feeds both its success and error outputs into **Code in JavaScript**.

**Note:** Because `allowedOrigins` is `*`, any domain can call this webhook. If this is production-facing, consider restricting origins or adding authentication.

---

## 2. Code in JavaScript

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `276ba152-bf72-4a77-a49c-e889df31b9eb` |
| **Language** | JavaScript (Code node) |

**Purpose:** Normalizes and expands the incoming webhook payload before routing:

1. **Field mapping by source** — Translates generic `jobType` and `workPlace` values into the vocabulary each platform expects:
   - *Indeed:* lowercase values (`fulltime`, `parttime`, `contract`, `temporary`, `internship`; `hybrid`, `remote`)
   - *LinkedIn:* uppercase/underscored values (`FULLTIME`, `PART_TIME`, `CONTRACT`, `TEMPORARY`, `INTERNSHIP`; `HYBRID`, `REMOTE`)
   - Falls back to the original value if no mapping exists for the given source.

2. **Multi-title fan-out** — Splits a comma-separated `jobTitle` string (e.g., `"Data Analyst, BI Developer"`) into individual titles, trims whitespace, and removes empty entries. It then returns **one output item per title**, each carrying the full original body plus its own `jobTitle`, mapped `jobType`, and mapped `workPlace`.

**Effect:** If a user submits multiple job titles in one request, this node causes the rest of the workflow to run once per title (n8n's default item-looping behavior).

**Downstream:** → **Switch**

---

## 3. Switch

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.switch` |
| **Node ID** | `67784759-0dd9-40c3-bebd-fc7b312b3424` |
| **Type Validation** | Strict, case-sensitive |

**Purpose:** Routes each item to the correct job-scraping branch based on the original webhook's `body.jobSource` field.

| Output | Condition |
|---|---|
| **Output 0** | `$('Webhook').item.json.body.jobSource` equals `"linkedin"` → **LinkedIn Job** |
| **Output 1** | `$('Webhook').item.json.body.jobSource` equals `"indeed"` → **Indeed Job** |

**Note:** The condition reads `jobSource` from the original **Webhook** node data (not from the Code node's output), ensuring routing is based on the raw, unmodified request value regardless of any transformation applied upstream. Since matching is case-sensitive, values must be lowercase exactly `linkedin` or `indeed`; any other value falls through with no match and no branch executes.

---

## 4. LinkedIn Job

| Property | Value |
|---|---|
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **Node ID** | `302017dd-140b-4d7e-8cea-d7cc3ce617d0` |
| **Operation** | Run actor and get dataset |
| **Actor** | ⚡️Rapid LinkedIn Jobs Scraper (`worldunboxer/rapid-linkedin-scraper`, ID `JkfTWxtpgfvcRQn3p`) |
| **Authentication** | Apify OAuth2 (credential: `Hemant`) |

**Request Body Sent to Actor:**
```json
{
  "easy_apply": false,
  "employment_type": "Full-time",
  "jobs_entries": "{{ NoOfJobs from Webhook }}",
  "jobs_titles": ["{{ jobTitle from Webhook }}"],
  "location": "{{ location from Webhook }}",
  "posted_within": "Past 24 hours",
  "work_arrangement": "Hybrid"
}
```

**Purpose:** Calls the Apify LinkedIn scraper to fetch job postings matching the given title and location. Returns a dataset of raw LinkedIn job listings.

**Notes / Fixed Values:**
- `employment_type` is hardcoded to `"Full-time"` and `work_arrangement` to `"Hybrid"` — these do **not** use the dynamically mapped `jobType`/`workPlace` values from the Code node, meaning user-selected job type/work arrangement preferences are currently **not applied** on the LinkedIn branch.
- `posted_within` is hardcoded to `"Past 24 hours"`, limiting results to very recent postings.
- `jobs_entries` is not explicitly cast to a number (unlike the Indeed branch), which could cause type issues if `NoOfJobs` arrives as a string.

**Downstream:** → **Build LinkedIn Company Array**

---

## 5. Indeed Job

| Property | Value |
|---|---|
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **Node ID** | `24927760-4e12-4ec7-893f-d4c6220b5fb0` |
| **Operation** | Run actor and get dataset |
| **Actor** | Indeed Jobs Scraper – Most Comprehensive (`kaix/indeed-scraper`, ID `BIeK7ZcYUrdxDgOEQ`) |
| **Authentication** | Apify OAuth2 (credential: `Hemant`) |
| **Always Output Data** | `true` — node returns an empty success output rather than failing if no items are found |

**Request Body Sent to Actor:**
```json
{
  "keyword": "{{ jobTitle from Webhook }}",
  "location": "{{ location from Webhook }}",
  "maxItems": "{{ Number(NoOfJobs) }}",
  "jobType": "{{ jobType from Webhook }}",
  "remote": "{{ workPlace from Webhook }}",
  "fromDays": "1",
  "radius": "50",
  "sort": "date",
  "searchMode": "rich"
}
```

**Purpose:** Calls the Apify Indeed scraper to fetch job postings matching the title, location, job type, and remote/hybrid preference. Results are sorted by posting date (most recent first), restricted to the last day (`fromDays: "1"`), and within a 50-unit radius.

**Notes:**
- Unlike the LinkedIn branch, this branch **does** use the dynamically mapped `jobType` and `workPlace` (`remote`) values.
- `maxItems` is explicitly cast with `Number(...)`, avoiding the type ambiguity present in the LinkedIn branch.

**Downstream:** → **Build Indeed Company Array**

---

## 6. Build LinkedIn Company Array

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `8ecd4278-7ba9-4fe4-963e-fb0d093b6e6b` |
| **Language** | JavaScript (Code node) |

**Purpose:** Normalizes the raw LinkedIn Apify output into a consistent job schema and consolidates all items into a single array.

**Output Schema (per job):**
```
job_id, job_url, job_title, company_name, company_url, location,
seniority_level, employment_type, time_posted, num_applicants,
salary_range, job_description, easy_apply, apply_url, resumeContent
```

**Key Logic:**
- Maps each raw Apify field directly to the standard field name (e.g., `j.job_id → job_id`), defaulting to an empty string, `null`, or `false` where a value is missing.
- Appends `resumeContent` from the **original webhook payload** (`$('Webhook').first().json.body.resumeContent`) to every job record, so each returned job carries the candidate's resume alongside it (likely for downstream matching/scoring in a separate process).
- Wraps the full array in a single n8n output item as `{ companies: [...], count: N }`.

**Downstream:** → **Respond to Webhook**

---

## 7. Build Indeed Company Array

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `bd2f6bf4-a889-4d9c-98b8-4aee1304fcdd` |
| **Language** | JavaScript (Code node) |

**Purpose:** Same normalization role as the LinkedIn equivalent, but tailored to Indeed's differently-structured Apify output, which uses nested objects (e.g., `title.text`, `company.name`, `location.formatted`).

**Output Schema (per job):** Identical to the LinkedIn array —
```
job_id, job_url, job_title, company_name, company_url, location,
seniority_level, employment_type, time_posted, num_applicants,
salary_range, job_description, easy_apply, apply_url, resumeContent
```

**Key Logic:**
- Uses chained fallback lookups (`||`) across multiple possible field names/paths per attribute, since the Indeed scraper's response shape can vary (e.g., `job_url` tries `urls.indeed`, then `urls.external`, then `job_url`).
- Also appends `resumeContent` from the original webhook payload to every job record.
- Wraps the result in the same `{ companies: [...], count: N }` shape as the LinkedIn branch, ensuring both branches converge on an identical output structure for the response node.

**Downstream:** → **Respond to Webhook**

---

## 8. Respond to Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **Node ID** | `2f5445b4-5de1-499c-82f8-b4c4e6a6cd1b` |
| **Respond With** | JSON |
| **Response Body** | `{{ $json.companies }}` |

**Purpose:** Sends the final HTTP response back to the original webhook caller, returning just the `companies` array (the normalized job listings) — not the wrapping `count` field or any other metadata.

**Inputs:** Receives from either **Build LinkedIn Company Array** or **Build Indeed Company Array**, whichever branch executed.

---

## 9. Job Search URL *(Unused / Disconnected)*

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.set` |
| **Node ID** | `77999c23-4da4-4f44-b7e9-f07a8a1a3c45` |
| **Always Output Data** | `false` |
| **Error Handling** | `continueRegularOutput` |

**Purpose (as configured):** A Set node that would assign:
- `body.jobTitle` ← `$json.body.jobTitle`
- `body.resume` ← `$json.body.resumeContent`
- `resume` (binary) ← literal string `'resume'`

**Status:** This node has **no incoming or outgoing connections** in the current workflow graph — its `main` output array is empty (`[[]]`) and no other node targets it. It does not execute during normal workflow runs and appears to be a leftover/orphaned node from an earlier version of the workflow, possibly related to resume file handling that was later removed or replaced.

**Recommendation:** Remove if no longer needed, or reconnect it if it was intended to handle binary resume uploads (its `resume` binary assignment suggests it may once have prepared a file for a separate processing branch).

---

## Data Flow Summary

| Stage | Node | Role |
|---|---|---|
| 1 | Webhook | Receives POST request with job search criteria + resume |
| 2 | Code in JavaScript | Normalizes job type/work place per source; splits multiple job titles into separate items |
| 3 | Switch | Routes each item to LinkedIn or Indeed branch |
| 4a | LinkedIn Job | Fetches LinkedIn listings via Apify actor |
| 4b | Indeed Job | Fetches Indeed listings via Apify actor |
| 5a | Build LinkedIn Company Array | Normalizes LinkedIn results to standard schema + attaches resume |
| 5b | Build Indeed Company Array | Normalizes Indeed results to standard schema + attaches resume |
| 6 | Respond to Webhook | Returns final `companies` array as JSON |
| — | Job Search URL | Orphaned node, not part of active flow |

## Observations & Potential Improvements

1. **Unused node:** `Job Search URL` should be removed or reconnected to avoid confusion for future maintainers.
2. **Hardcoded LinkedIn filters:** `employment_type: "Full-time"` and `work_arrangement: "Hybrid"` on the LinkedIn actor call ignore the user-submitted `jobType`/`workPlace` values that are otherwise mapped correctly for Indeed. This is likely worth aligning for consistent behavior across both sources.
3. **Type safety:** `jobs_entries` in the LinkedIn actor body isn't explicitly cast to a number, unlike `maxItems` in the Indeed call (`Number(...)`), which could cause inconsistent behavior if `NoOfJobs` is submitted as a string.
4. **Case sensitivity in Switch:** Since the `jobSource` match is case-sensitive, requests with `"LinkedIn"` or `"Indeed"` (capitalized) will silently fail to route, with no jobs returned and no explicit error. Consider normalizing case (e.g., `.toLowerCase()`) before the Switch, similar to what's already done in the Code node.
5. **Open CORS policy:** `allowedOrigins: "*"` on the Webhook permits calls from any origin; consider restricting this in production.
6. **Response payload:** Only `companies` is returned to the caller; `count` is computed but discarded at the response stage — include it in the response if the client needs a total count without counting the array client-side.
