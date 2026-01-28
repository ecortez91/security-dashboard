# 🛡️ Security Dashboard

Personal Security & Health Monitor for your system.

## Features

- **Real-time Security Scanning** - Comprehensive security checks
- **Beautiful Dashboard** - Modern, responsive UI with dark mode
- **One-Click Fixes** - Apply security fixes directly from the dashboard
- **Detailed Reports** - In-depth analysis with actionable recommendations

## Security Checks

| Check | Description |
|-------|-------------|
| **Open Ports** | Detects ports exposed to all interfaces |
| **Firewall** | Verifies firewall is active (UFW, iptables, Windows) |
| **SSH Security** | Checks SSH configuration best practices |
| **Gateway** | Monitors Clawdbot Gateway security |
| **System Updates** | Checks for pending security updates |
| **File Permissions** | Validates critical file permissions |
| **Running Services** | Identifies potentially risky services |
| **Network Exposure** | Analyzes network interface exposure |

## Quick Start

```bash
# Install dependencies
cd security-dashboard
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Run both servers
npm run dev
```

Or separately:

```bash
# Terminal 1 - Backend (port 4000)
cd backend && npm run dev

# Terminal 2 - Frontend (port 3000)
cd frontend && npm run dev
```

## Access

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:4000/api/checks
- **Health**: http://localhost:4000/health

## Architecture

```
security-dashboard/
├── backend/          # Express API server
│   └── src/
│       ├── index.js
│       └── checks/   # Security check modules
├── frontend/         # Next.js dashboard
│   └── app/
│       └── page.tsx  # Main dashboard
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/checks` | Run all security checks |
| GET | `/api/checks/:id` | Run specific check |
| POST | `/api/fixes/:id` | Apply a fix |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Icons**: Heroicons

## License

MIT
