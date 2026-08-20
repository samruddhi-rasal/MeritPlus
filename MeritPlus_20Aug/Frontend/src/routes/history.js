const express = require("express");
const ExcelJS = require("exceljs");
const historyRepo = require("../sheets/historyRepo");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

// GET /api/history
router.get("/", async (req, res, next) => {
  try {
    const rows = await historyRepo.listByUser(req.user.id); // req.user.id comes from the verified JWT
    res.json(rows.map(r => ({
      id: r.id,
      session_id: r.session_id,
      company_name: r.company_name,
      job_title: r.job_title,
      location: r.location,
      apply_link: r.apply_link,
      resume_url: r.resume_url,
      cover_letter_url: r.cover_letter_url,
      generated_at: r.generated_at
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/history/download — generated on demand from the History sheet,
// never stored on disk, never includes JWTs or auth material.
router.get("/download", async (req, res, next) => {
  try {
    const rows = await historyRepo.listByUser(req.user.id);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Application History");

    sheet.columns = [
      { header: "Company", key: "company_name", width: 28 },
      { header: "Job Title", key: "job_title", width: 32 },
      { header: "Location", key: "location", width: 22 },
      { header: "Apply Link", key: "apply_link", width: 40 },
      { header: "Resume", key: "resume_url", width: 40 },
      { header: "Cover Letter", key: "cover_letter_url", width: 40 },
      { header: "Generated At", key: "generated_at", width: 22 }
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach(row => sheet.addRow(row));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=application-history.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
