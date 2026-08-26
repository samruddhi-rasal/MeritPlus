const express = require("express");
const cors = require("cors");
const jobsRoutes = require("../../src/routes/jobs");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());
app.use("/api/jobs", jobsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});

module.exports = app;
