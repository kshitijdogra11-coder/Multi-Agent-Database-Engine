# 🧠 Multi-Agent Database Engine Architecture

<div align="center">

### 👤 Author: **Kshitij Dogra**
🔗 [GitHub](https://github.com/kshitijdogra11-coder) &nbsp;•&nbsp; ✉️ [Email](kshitjdogra11@gmail.com)

</div>

<div align="center">

### ⚙️ A mini database engine powered by a pipeline of specialized AI-style agents

*Query parsing → planning → optimization → security → validation → execution — each handled by its own dedicated agent, orchestrated end-to-end, on top of a hand-built storage engine with B-tree indexing and buffer pooling.*

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

![License](https://img.shields.io/badge/license-Educational-blue?style=flat-square)
![Status](https://img.shields.io/badge/status-active-success?style=flat-square)
![Made with](https://img.shields.io/badge/made%20with-%E2%9D%A4%EF%B8%8F-red?style=flat-square)

</div>

---

## 📖 Overview

Instead of one function doing everything, this project splits query processing into **distinct agents**, each with a single responsibility, coordinated by a central orchestrator 🎼

```
📝 Query string
     │
     ▼
┌───────────────┐
│ 🔍 Parser     │  → turns raw SQL-like text into a structured query
└───────────────┘
     │
     ▼
┌───────────────┐
│ 🛡️ Security   │  → checks the query for unsafe operations
└───────────────┘
     │
     ▼
┌───────────────┐
│ 🗺️ Planner    │  → builds an execution plan
└───────────────┘
     │
     ▼
┌───────────────┐
│ ⚡ Optimizer  │  → rewrites/optimizes the plan
└───────────────┘
     │
     ▼
┌───────────────┐
│ ✅ Validator  │  → validates the plan against schema/constraints
└───────────────┘
     │
     ▼
┌───────────────┐
│ 🚀 Executor   │  → runs the plan against the storage engine
└───────────────┘
     │
     ▼
📊 Result
```

---

## 🧩 Core Components

### 🤖 Agents — `src/engine/agents/`
| Agent | File | Responsibility |
|---|---|---|
| 🔍 Parser | `parser.ts` | Converts raw query text into structured form |
| 🛡️ Security | `security.ts` | Screens for unsafe operations |
| 🗺️ Planner | `planner.ts` | Builds the execution plan |
| ⚡ Optimizer | `optimizer.ts` | Optimizes the plan for performance |
| ✅ Validator | `validator.ts` | Validates against schema & constraints |
| 🚀 Executor | `executor.ts` | Executes the plan |

### 🎼 Orchestrator — `src/engine/orchestrator.ts`
Coordinates the full agent pipeline, with optional:
- 🐛 `DEBUG_ORCHESTRATOR` → verbose step-by-step logging
- 📝 `ENABLE_PG_LOGGING` → logs query history to PostgreSQL

### 💾 Storage Engine — `src/engine/core/`
| File | Purpose |
|---|---|
| `storage.ts` | 📄 Page-based storage manager |
| `buffer.ts` | 🧠 LRU buffer pool for page caching |
| `btree.ts` | 🌳 B-tree indexing |
| `table.ts` | 📋 Table catalog & operations |
| `engine.ts` | 🔌 `ByteDBEngine` — the public API (`createTable`, `insert`, `select`, `update`, `delete`, `listTables`, `stats`) |

### 🖥️ Web Console — `src/app`, `src/components`
A Next.js UI featuring:
- 💬 Live query chat/console
- 🐞 Debug panel
- 🏗️ Architecture explainer
- 📈 Performance metrics dashboard

### 🗄️ Persistence Layer — `src/db/`
Drizzle ORM schema + PostgreSQL connection, used for logging/history alongside the in-memory engine.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| 🖼️ Framework | Next.js 16, React 19 |
| 🔤 Language | TypeScript |
| 🐘 Database | PostgreSQL |
| 🧬 ORM | Drizzle ORM |
| 🎨 Styling | Tailwind CSS |
| 📊 Charts | Recharts |
| ✨ Animation | Framer Motion |

---

## 🚀 Getting Started

### ✅ Prerequisites
- Node.js 18+
- A running PostgreSQL instance (local or hosted)

### ⚙️ Setup

```bash
# 📦 Install dependencies
npm install

# 🔐 Configure environment
echo "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db" > .env

# 🗂️ Push schema to the database
npx drizzle-kit push

# ▶️ Run the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** 🌐 to view the app.

### 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | 🧑‍💻 Start the Next.js development server |
| `npm run build` | 📦 Build for production |
| `npm run start` | ▶️ Run the production build |
| `npm run lint` | 🧹 Run ESLint |
| `npm run typecheck` | 🔎 Run TypeScript type checking |

---

## 📁 Project Structure

```
├── 📂 src/
│   ├── 📂 app/                # Next.js app router pages & API routes
│   │   └── 📂 api/            # chat, debug, engine, health, history, metrics, query
│   ├── 📂 components/         # UI components (chat, console, architecture, features)
│   ├── 📂 db/                 # Drizzle schema & PostgreSQL connection
│   └── 📂 engine/
│       ├── 📂 agents/         # Parser, Planner, Optimizer, Security, Validator, Executor
│       ├── 📂 core/           # Storage engine: B-tree, buffer pool, table manager
│       ├── 📄 orchestrator.ts # Pipeline coordinator
│       └── 📄 types.ts        # Shared engine types
├── ⚙️ drizzle.config.json
├── ⚙️ next.config.ts
└── 📦 package.json
```

---

## 🔐 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | 🐘 PostgreSQL connection string |
| `DEBUG_ORCHESTRATOR` | 🐛 Set to `true` for verbose orchestrator logging |
| `ENABLE_PG_LOGGING` | 📝 Set to `true` to log query history to PostgreSQL |

---

## 📜 License

📚 This project is for **educational/demonstration purposes**.

---

<div align="center">

### ⭐ If you found this project interesting, consider giving it a star!

</div>