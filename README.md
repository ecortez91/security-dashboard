# 🛡️ Security Dashboard

Personal Security & Health Monitor for your system.

## Features

- **Real-time Security Scanning** - Comprehensive security checks
- **🌡️ Temperature Monitoring** - Live CPU/GPU temps via [thermal-pulse](https://github.com/ecortez91/thermal-pulse)
- **Beautiful Dashboard** - Modern, responsive UI with dark mode
- **One-Click Fixes** - Apply security fixes directly from the dashboard
- **Detailed Reports** - In-depth analysis with actionable recommendations

## Security Checks

| Check | Description |
|-------|-------------|
| **🌡️ Temperature** | Real-time CPU/GPU temperature monitoring |
| **Hardware** | System health, memory, disk usage |
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
# Clone with submodules
git clone --recurse-submodules https://github.com/ecortez91/security-dashboard.git
cd security-dashboard

# Install dependencies
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

## Temperature Monitoring Setup

The temperature monitoring feature uses [thermal-pulse](https://github.com/ecortez91/thermal-pulse) to interface with LibreHardwareMonitor.

### Prerequisites

1. **Install LibreHardwareMonitor** (Windows)
   - Download from [GitHub Releases](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases)
   - Run as Administrator
   - Enable **Options → Remote Web Server**

2. **Configure credentials** (optional)
   ```bash
   # In backend/.env
   LHM_HOST=localhost
   LHM_PORT=8085
   LHM_USERNAME=your_username
   LHM_PASSWORD=your_password
   ```

### Temperature API

The dashboard exposes a dedicated temperature endpoint for real-time monitoring:

```bash
# Get current temperatures
curl http://localhost:4000/api/temperature

# Response
{
  "success": true,
  "timestamp": "2026-01-28T22:30:00.000Z",
  "summary": {
    "cpu": { "package": 68.0, "average": 62.5 },
    "gpu": { "core": 45.0, "hotspot": 52.0 }
  },
  "temperatures": [...]
}
```

## Access

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:4000/api/checks
- **Temperature**: http://localhost:4000/api/temperature
- **Health**: http://localhost:4000/health

## Architecture

```
security-dashboard/
├── backend/              # Express API server
│   └── src/
│       ├── index.js
│       └── checks/
│           ├── temperature.js  # thermal-pulse integration
│           ├── hardware.js
│           └── ...
├── frontend/             # Next.js dashboard
│   └── app/
│       └── page.tsx
├── tools/
│   └── thermal-pulse/    # Temperature monitoring submodule
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/checks` | Run all security checks |
| GET | `/api/checks/:id` | Run specific check |
| GET | `/api/temperature` | Get temperature data (lightweight) |
| POST | `/api/fixes/:id` | Apply a fix |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Temperature**: [thermal-pulse](https://github.com/ecortez91/thermal-pulse) + LibreHardwareMonitor
- **Icons**: Heroicons

## Submodules

This repo includes:
- `tools/thermal-pulse` - System temperature monitoring tool

To update submodules:
```bash
git submodule update --remote
```

## License

MIT
