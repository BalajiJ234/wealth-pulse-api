# Wealth Pulse API

> Backend API for Wealth Pulse - Personal Finance Tracker

## 🚀 Live URLs

| Environment         | URL                         |
| ------------------- | --------------------------- |
| Production (Future) | `https://api.balaji-dev.in` |
| Local Development   | `http://localhost:8080`     |

## 🏗️ Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15 (Week 2)
- **Cache**: Redis 7 (Week 3)
- **Container**: Docker

## 📁 Project Structure

```
wealth-pulse-api/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── middleware/
│   │   ├── errorHandler.ts   # Global error handler
│   │   └── notFoundHandler.ts
│   ├── routes/
│   │   ├── health.routes.ts  # Health check endpoints
│   │   └── expense.routes.ts # Expense CRUD endpoints
│   ├── controllers/          # (Week 2)
│   ├── services/             # (Week 2)
│   ├── models/               # (Week 2)
│   └── utils/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/BalajiJ234/wealth-pulse-api.git
cd wealth-pulse-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build image manually
docker build -t wealth-pulse-api .
docker run -p 8080:8080 wealth-pulse-api
```

## 📡 API Endpoints

### Health Check

| Method | Endpoint            | Description           |
| ------ | ------------------- | --------------------- |
| GET    | `/api/health`       | Health status         |
| GET    | `/api/health/ready` | Readiness check (K8s) |
| GET    | `/api/health/live`  | Liveness check (K8s)  |

### Expenses (In-memory for now)

| Method | Endpoint            | Description        |
| ------ | ------------------- | ------------------ |
| GET    | `/api/expenses`     | Get all expenses   |
| GET    | `/api/expenses/:id` | Get single expense |
| POST   | `/api/expenses`     | Create expense     |
| PUT    | `/api/expenses/:id` | Update expense     |
| DELETE | `/api/expenses/:id` | Delete expense     |

### Example Request

```bash
# Create expense
curl -X POST http://localhost:8080/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "category": "Food", "description": "Lunch"}'

# Get all expenses
curl http://localhost:8080/api/expenses
```

## 📅 Development Roadmap

| Week   | Focus                      | Status      |
| ------ | -------------------------- | ----------- |
| Week 1 | Express + TypeScript setup | ✅ Complete |
| Week 2 | PostgreSQL + Prisma ORM    | 🎯 Next     |
| Week 3 | Redis caching              | ⏳ Upcoming |
| Week 4 | NGINX reverse proxy        | ⏳ Upcoming |

## 🔗 Related Projects

| Project               | Repository                                                   | Description            |
| --------------------- | ------------------------------------------------------------ | ---------------------- |
| Wealth Pulse Frontend | [wealthpulse](https://github.com/BalajiJ234/wealthpulse)     | React/Next.js frontend |
| Life Notes            | [life-notes](https://github.com/BalajiJ234/life-notes)       | Notes & todos app      |
| Life-Sync Gateway     | [life-sync-2.0](https://github.com/BalajiJ234/life-sync-2.0) | Docs & gateway         |

## 📜 License

MIT © Balaji J

LifeSync 2.0 context (Dec 2025):

- Subscription: Azure subscription 1 (Free Trial)
- RG: lifesync-prod, Region: UAE North
- ACR: lifesyncreg.azurecr.io (Basic)
- Container Apps Env: managedEnvironment-lifesyncprod-afcc
- Log workspace: workspacelifesyncproda3ff
- Repo now: wealth-pulse-api (Node/Express) port 8080
- Goal: CLI-first, AZ-204 aligned, no Redis/K8s/Terraform till Mar 2026
- ACR created and We pushed two version of the image to the Azure Container Registry
- Created Azure Container App
  Task now: <what you want to do>
- Today task: Need to check the connectivity (In Progress)
