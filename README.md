# 🚀 AI Resume Optimizer

> An intelligent AI-powered Resume Optimization and Job Application Automation System built using **React**, **n8n**, **OpenAI**, **Claude**, **Google Workspace APIs**, and **Apify**.

![GitHub](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/Frontend-React-61DAFB)
![n8n](https://img.shields.io/badge/Automation-n8n-FF6D5A)
![OpenAI](https://img.shields.io/badge/AI-OpenAI-412991)
![Claude](https://img.shields.io/badge/LLM-Claude-D97757)
![License](https://img.shields.io/badge/License-MIT-blue)

---

# 📖 Table of Contents

- Overview
- Problem Statement
- Features
- System Architecture
- Project Workflow
- Technologies Used
- Folder Structure
- Installation
- Configuration
- Running the Project
- Workflow Pipeline
- Documentation
- Screenshots
- Future Improvements
- Contributors
- License

---

# 📌 Overview

AI Resume Optimizer is an intelligent job application assistant that automates the complete resume customization process.

Instead of manually editing resumes for every job application, the system automatically:

- Searches for jobs
- Analyzes job descriptions
- Parses uploaded resumes
- Optimizes resumes using AI
- Generates personalized cover letters
- Produces professionally formatted DOCX files
- Stores generated documents
- Returns downloadable results through the frontend

The project combines Large Language Models with workflow automation to significantly reduce the time required to apply for multiple jobs while maintaining high-quality, ATS-compatible resumes.

---

# 🎯 Problem Statement

Job seekers spend considerable time customizing resumes and cover letters for each job application.

Common challenges include:

- Manual resume editing
- ATS keyword optimization
- Cover letter writing
- Formatting inconsistencies
- Applying to multiple job portals
- Managing generated documents

This project addresses these challenges by automating the complete resume optimization workflow.

---

# ✨ Features

## Resume Optimization

- AI-powered resume tailoring
- ATS keyword optimization
- Professional formatting
- Section reorganization
- Skill highlighting

---

## Cover Letter Generation

- Personalized cover letters
- Job-specific customization
- Professional language
- ATS-friendly writing

---

## Job Search Automation

Supports:

- LinkedIn Jobs
- Indeed Jobs

Automatically extracts:

- Job Title
- Company
- Job Description
- Application Link
- Salary
- Company Information

---

## AI Integration

Supports multiple LLM providers.

- OpenAI GPT
- Claude

---

## Workflow Automation

Built completely using n8n.

Automates:

- Resume Processing
- AI Generation
- Google Docs
- Google Sheets
- Response Generation

---

## Resume Upload

Supports DOCX upload.

Workflow

```
Upload Resume

↓

Binary File

↓

Resume Extraction

↓

Structured Resume

↓

AI Processing
```

---

## Professional Resume Formatting

Instead of generating plain text,

the project reconstructs professional DOCX documents using XML-based formatting to preserve:

- Headings
- Bullet points
- Fonts
- Margins
- Tables
- ATS-friendly layouts

---

# 🏗️ System Architecture

```
                React Frontend

                      │

                      ▼

               n8n Webhook

                      │

        ┌─────────────┴─────────────┐

        ▼                           ▼

 Resume Upload               Job Search

        │                           │

        ▼                           ▼

 Resume Parser              LinkedIn / Indeed

        │                           │

        └─────────────┬─────────────┘

                      ▼

             Job Description

                      │

                      ▼

              AI Processing

          ┌──────────┴──────────┐

          ▼                     ▼

     Resume AI            Cover Letter AI

          │                     │

          └──────────┬──────────┘

                     ▼

          XML Resume Formatter

                     ▼

            Professional DOCX

                     ▼

             Google Workspace

                     ▼

              Frontend Response
```

---

# ⚙️ Project Workflow

```
User Uploads Resume

↓

Frontend

↓

Webhook

↓

Resume Parser

↓

Job Scraper

↓

AI Resume Generator

↓

AI Cover Letter Generator

↓

Resume Formatter

↓

Generate DOCX

↓

Store Results

↓

Return Download Links
```

---

# 🛠️ Technologies Used

## Frontend

- React
- HTML5
- CSS3
- JavaScript

---

## Backend Automation

- n8n

---

## Artificial Intelligence

- OpenAI GPT
- Claude

---

## APIs

- Google Docs API
- Google Drive API
- Google Sheets API
- Apify API

---

## Job Platforms

- LinkedIn
- Indeed

---

## Document Processing

- DOCX
- XML
- ZIP
- Binary Processing

---

## Development Tools

- VS Code
- Git
- GitHub
- Postman

---

# 📂 Repository Structure

```
AI-Resume-Optimizer/

│

├── frontend/

│   ├── src/

│   ├── public/

│   └── package.json

│

├── backend/

│

├── workflows/

│   ├── production.json

│   ├── workflow_v1.json

│   ├── workflow_v2.json

│

├── templates/

│   ├── Resume.docx

│   ├── CoverLetter.docx

│

├── docs/

│   ├── Project_Overview.md

│   ├── Requirement_Gathering.md

│   ├── System_Analysis.md

│   ├── Workflow.md

│   ├── Node_Documentation.md

│

├── screenshots/

│

├── README.md

└── LICENSE
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/<username>/AI-Resume-Optimizer.git
```

---

## Install Frontend

```bash
cd frontend

npm install
```

---

## Start React

```bash
npm start
```

---

## Import n8n Workflow

1. Open n8n

2. Import workflow JSON

3. Configure credentials

4. Activate workflow

---

# 🔑 Configuration

The following credentials are required.

| Service | Purpose |
|----------|----------|
| OpenAI API | Resume Generation |
| Claude API | Resume Generation |
| Google Docs API | Document Creation |
| Google Drive API | Storage |
| Google Sheets API | Logging |
| Apify API | Job Scraping |

---

# 📚 Documentation

Complete documentation is available inside the **docs** folder.

| Document | Description |
|-----------|-------------|
| Project Overview | System Introduction |
| Requirement Gathering | Functional & Non-functional Requirements |
| System Analysis | Analysis and Design |
| Development Planning | Sprint Planning |
| Workflow | n8n Workflow Explanation |
| Node Documentation | Complete Node Reference |
| APIs | External Integrations |
| Prompt Engineering | AI Prompt Design |
| Data Flow | System Data Movement |
| Testing | Validation Process |
| Deployment | Production Setup |

---

# 📸 Screenshots

The following screenshots should be added.

```
screenshots/

frontend-home.png

resume-upload.png

workflow.png

generated-resume.png

generated-cover-letter.png

google-doc.png
```

---

# 📈 Project Evolution

The project evolved through multiple development stages.

| Phase | Description |
|--------|-------------|
| Phase 1 | Gemini AI Prototype |
| Phase 2 | OpenAI Integration |
| Phase 3 | Frontend Development |
| Phase 4 | Webhook Integration |
| Phase 5 | Resume Parsing |
| Phase 6 | DOCX Upload |
| Phase 7 | XML Resume Formatting |
| Phase 8 | Production Deployment |

---

# 🔮 Future Improvements

- Multi-language resume generation
- ATS score visualization
- Interview preparation module
- Portfolio generation
- AI career recommendations
- Resume version management
- PDF export
- One-click job applications
- Recruiter dashboard
- Analytics dashboard

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository

2. Create a feature branch

3. Commit changes

4. Push branch

5. Open a Pull Request

---

# 👩‍💻 Author

**Samruddhi Rasal**

B.Tech Computer Science & Engineering (Artificial Intelligence & Analytics)

MIT Art, Design and Technology University

---

# 📄 License

This project is licensed under the MIT License.

---

# ⭐ Acknowledgements

This project makes use of the following technologies:

- React
- n8n
- OpenAI
- Claude
- Google Workspace APIs
- Apify
- GitHub
- VS Code

---

> If you find this project useful, consider giving it a ⭐ on GitHub.
