const express = require("express");
const multer = require("multer");
const historyRepo = require("../sheets/historyRepo");
const authenticate = require("../middleware/authenticate");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

router.use(authenticate);

// POST /api/jobs/search
// Forwards the same multipart form the frontend always sent to the existing
// n8n workflow — nothing about that workflow changes.
router.post("/search", upload.single("resume"), async (req, res, next) => {
  try {
    const forwardForm = new FormData();

    for (const [key, value] of Object.entries(req.body)) {
      forwardForm.append(key, value);
    }

    if (req.file) {
      forwardForm.append(
        "resume",
        new Blob([req.file.buffer], { type: req.file.mimetype }),
        req.file.originalname
      );
    }

    const n8nResponse = await fetch(process.env.N8N_SEARCH_JOBS_URL, {
      method: "POST",
      body: forwardForm
    });

    const text = await n8nResponse.text();
    if (!n8nResponse.ok) {
      return res.status(n8nResponse.status).send(text);
    }

    res.type("application/json").send(text);
  } catch (error) {
    next(error);
  }
});

// POST /api/jobs/generate-resume
// Forwards the selected job row to the existing n8n workflow, then logs the
// result to the History sheet against this user's session.
router.post("/generate-resume", express.json(), async (req, res, next) => {
  try {
    const n8nResponse = await fetch(process.env.N8N_GENERATE_RESUME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await n8nResponse.text();
    if (!n8nResponse.ok) {
      return res.status(n8nResponse.status).send(text);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const result = Array.isArray(parsed) ? parsed[0] : parsed;

    if (result) {
      await historyRepo.create({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        companyName: result.companyName || req.body.company_name || req.body["Company Name"] || "",
        jobTitle: result.title || req.body.job_title || req.body["Job Title"] || "",
        location: result.location || req.body.location || "",
        applyLink: result.ApplyLink || req.body.job_url || "",
        resumeUrl: result.resumeUrl || "",
        coverLetterUrl: result.coverLetterUrl || "",
        resumeContent: result.resumeContent || "",
        coverLetterContent: result.coverLetterContent || ""
      });
    }

    res.type("application/json").send(text);
  } catch (error) {
    next(error);
  }
});

// POST /api/jobs/interview-questions
// Forwards resume + job description to the third n8n workflow
// (generateInterviewQuestions) and returns the generated questions as-is.
router.post("/interview-questions", express.json(), async (req, res, next) => {
  try {
    const n8nResponse = await fetch(process.env.N8N_INTERVIEW_QUESTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeContent: req.body.resumeContent || "",
        jobDescription: req.body.jobDescription || "",
        jobTitle: req.body.jobTitle || "",
        companyName: req.body.companyName || ""
      })
    });

    const text = await n8nResponse.text();
    if (!n8nResponse.ok) {
      return res.status(n8nResponse.status).send(text);
    }

    res.type("application/json").send(text);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
