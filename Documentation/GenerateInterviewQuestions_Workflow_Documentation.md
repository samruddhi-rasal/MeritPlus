# n8n Workflow Documentation: `Generate Interview Questions`

**Workflow ID:** `1h9WIWvoL6zcj57p`
**Status:** Inactive (`active: false`)
**Purpose:** Receives a candidate's resume and a target job's details via webhook, uses Claude (Anthropic) to generate a tailored set of 10 interview questions based on the overlap and gaps between the resume and job description, and returns the structured question set as a JSON response.

---

## Workflow Overview

```
Webhook → Take Input → INTERVIEWQUESTIONS (Claude) → Normalize Output → Respond to Webhook
```

A simple, linear five-node pipeline with no branching or merging.

---

## 1. Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.webhook` |
| **Node ID** | `e50fef56-ba15-4667-af96-fb72e8e09668` |
| **HTTP Method** | `POST` |
| **Path** | `/generateInterviewQuestions` |
| **Webhook ID** | `generate-interview-questions` |
| **Response Mode** | `responseNode` (final reply sent by **Respond to Webhook**) |
| **Allowed Origins** | `*` (open CORS — any origin can call this endpoint) |

**Purpose:** Entry point of the workflow. Expects a POST request body containing `resumeContent`, `jobDescription`, `jobTitle`, and `companyName`.

**Downstream:** → **Take Input**

---

## 2. Take Input

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.set` |
| **Node ID** | `43998941-61c1-4140-9ac5-192269b348b1` |

**Purpose:** Extracts the four required fields from the raw webhook body into top-level, easily-referenced variables for downstream nodes:

| Output Field | Source |
|---|---|
| `resumeContent` | `body.resumeContent` |
| `jobDescription` | `body.jobDescription` |
| `jobTitle` | `body.jobTitle` |
| `companyName` | `body.companyName` |

**Downstream:** → **INTERVIEWQUESTIONS**

---

## 3. INTERVIEWQUESTIONS

| Property | Value |
|---|---|
| **Type** | `@n8n/n8n-nodes-langchain.anthropic` |
| **Node ID** | `e3d9ee2c-0370-49e2-83f1-0e0733d3ab2d` |
| **Model** | `claude-opus-4-8` |
| **Max Tokens** | `30000` |
| **Credential** | Anthropic API (`HemantSir`) |

**Purpose:** Calls Claude, acting as an "expert technical interviewer and career coach," to generate realistic, role-specific interview questions grounded in the actual overlaps and gaps between the candidate's resume and the target job description — explicitly instructed to avoid generic filler questions.

**Prompt Requirements:**
- **Fixed question distribution:** Exactly 10 questions — 3 **Behavioral**, 4 **Technical**, 3 **Role-Specific**.
- **Strict JSON output:** No Markdown code fences or commentary; must match the exact shape:
  ```json
  {
    "questions": [
      { "category": "Behavioral", "question": "..." },
      { "category": "Technical", "question": "..." },
      { "category": "Role-Specific", "question": "..." }
    ]
  }
  ```

**User Message:** Injects `jobTitle`, `companyName`, `jobDescription`, and `resumeContent` from **Take Input** into the prompt, followed by an explicit instruction to generate the questions now.

**Downstream:** → **Normalize Output**

---

## 4. Normalize Output

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.code` |
| **Node ID** | `0eb43e8a-cd2e-4145-acfa-9557d2604286` |
| **Language** | JavaScript (Code node) |

**Purpose:** Parses Claude's raw response and reshapes it into a clean, consistent result object for the API response.

**Key Logic:**
1. Reads the raw text from `content[0].text` on the AI node's output.
2. Strips any accidental Markdown code fences (```` ```json ```` / ```` ``` ````) the model might have added despite instructions not to.
3. Attempts `JSON.parse` on the cleaned text.
4. **On parse failure:** Returns a structured error result — `success: false`, the original `jobTitle`/`companyName` (pulled from **Take Input**), an empty `questions` array, an `error` message, and the `raw` unparsed text for debugging. The workflow does **not** throw or halt; it gracefully degrades to an error payload.
5. **On parse success:** Returns `success: true` along with `jobTitle`, `companyName`, and the parsed `questions` array (defaulting to `[]` if the `questions` key is missing from the parsed object).

**Downstream:** → **Respond to Webhook**

---

## 5. Respond to Webhook

| Property | Value |
|---|---|
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **Node ID** | `bb0b049d-f60d-4789-9a30-1642a45af417` |
| **Respond With** | JSON |
| **Response Body** | `{ success, jobTitle, companyName, questions }` (explicitly re-serialized via `JSON.stringify`) |

**Purpose:** Sends the final HTTP response back to the caller, echoing the success flag, job title, company name, and the generated (or empty, on failure) questions array.

---

## Data Flow Summary

| Stage | Node | Role |
|---|---|---|
| 1 | Webhook | Receives POST request with resume + job details |
| 2 | Take Input | Extracts and flattens request fields |
| 3 | INTERVIEWQUESTIONS | Claude generates 10 tailored interview questions as JSON |
| 4 | Normalize Output | Parses AI response; handles success/failure gracefully |
| 5 | Respond to Webhook | Returns final JSON result to caller |

## Observations & Potential Improvements

1. **Workflow is inactive:** `"active": false` — this workflow will not currently respond to webhook calls until it is activated in n8n.
2. **Open CORS policy:** `allowedOrigins: "*"` on the Webhook permits calls from any origin; consider restricting this in production, consistent with the other workflows in this project.
3. **Graceful failure handling:** Unlike some of the other workflows reviewed (e.g., the resume/cover letter generator, which throws hard errors on parse failure), this workflow's **Normalize Output** node degrades gracefully to a `success: false` response with the raw text included — a good pattern for a user-facing API, since the caller gets a usable, predictable JSON shape either way rather than a 500 error.
4. **No truncation safeguard:** With `maxTokens: 30000`, truncation is unlikely for a 10-question response, but there's no repair/retry logic (unlike the cover-letter workflow's `attemptRepair` function) if Claude ever returns malformed JSON for a reason other than truncation — a parse failure here simply reports the error rather than attempting a fix.
5. **No question-count/category validation:** The code trusts Claude to return exactly 10 questions in the specified 3/4/3 category split; there's no server-side check that the returned `questions` array actually matches the prompt's requirements before responding to the caller.
6. **Single Claude call, no fan-out:** Unlike the resume/cover-letter workflow, this one has no parallel branches or merge step — a simpler, single-purpose linear pipeline appropriate for its narrower scope.
