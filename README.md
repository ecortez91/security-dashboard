# 🛡️ Security Dashboard

A personal Security & System Health Monitor with real-time temperature monitoring.

## What is This?

**Security Dashboard** is a web-based monitoring tool that runs security checks on your system and displays real-time hardware temperatures. It's designed to run in WSL2 while monitoring a Windows host.

### Related Repositories

| Repository | Purpose |
|------------|---------|
| [security-dashboard](https://github.com/ecortez91/security-dashboard) | Main dashboard (this repo) - Next.js frontend + Express backend |
| [thermal-pulse](https://github.com/ecortez91/thermal-pulse) | Temperature monitoring library - interfaces with LibreHardwareMonitor |

The `thermal-pulse` module is included as a git submodule in `tools/thermal-pulse/`.

---

## Features

- 🌡️ **Real-time Temperature Monitoring** - CPU/GPU temps via LibreHardwareMonitor
- 🔒 **Security Scanning** - SSH, firewall, open ports, file permissions
- 🖥️ **Hardware Health** - Memory, disk usage, system load
- 🎨 **Modern Dashboard** - Dark mode, responsive UI
- 🔧 **One-Click Fixes** - Apply security fixes directly from the UI

---

## Quick Start

### 1. Clone the Repository

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/ecortez91/security-dashboard.git
cd security-dashboard

# If you already cloned without submodules:
git submodule update --init --recursive
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (for Temperature Monitoring)

Create `backend/.env`:

```bash
# LibreHardwareMonitor connection (Windows host)
LHM_HOST=172.22.80.1          # WSL2 gateway IP (or localhost if running natively)
LHM_PORT=8085                  # LHM web server port
LHM_USERNAME=your_username     # Optional: LHM auth username
LHM_PASSWORD="your_password"   # Optional: LHM auth password (quote if contains special chars)
```

**Finding your WSL2 gateway IP:**
```bash
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

### 4. Start the Dashboard

```bash
npm run dev
```

This starts both:
- **Frontend** (Next.js): http://localhost:3000
- **Backend** (Express): http://localhost:4000

---

## Temperature Monitoring Setup (Windows + WSL2)

The temperature feature requires **LibreHardwareMonitor** running on Windows.

### Step 1: Install LibreHardwareMonitor

1. Download from [GitHub Releases](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases)
2. Extract and run `LibreHardwareMonitor.exe` **as Administrator**

### Step 2: Enable Remote Web Server

1. In LHM: **Options → Remote Web Server** ✅
2. Go to **Options → Remote Web Server → Settings**:
   - Set port (default: `8085`)
   - Set bind address to `0.0.0.0` (required for WSL2 access)
   - Optionally set username/password

### Step 3: Allow Through Firewall (PowerShell as Admin)

```powershell
New-NetFirewallRule -DisplayName "LHM Web Server" -Direction Inbound -LocalPort 8085 -Protocol TCP -Action Allow
```

### Step 4: Test Connection from WSL2

```bash
# Replace IP with your WSL2 gateway
curl http://172.22.80.1:8085/data.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/api/checks` | Run all security checks |
| `GET` | `/api/checks/:id` | Run specific check |
| `GET` | `/api/temperature` | Get real-time temperature data |
| `POST` | `/api/fixes/:id` | Apply a security fix |

### Temperature Response Example

```json
{
  "success": true,
  "timestamp": "2026-01-28T22:30:00.000Z",
  "summary": {
    "cpu": { "package": 55, "average": 52.2, "max": 82 },
    "gpu": { "core": 57, "hotspot": 63, "max": 59 }
  },
  "temperatures": [
    { "name": "CPU Package", "value": 55, "category": "CPU" },
    { "name": "GPU Core", "value": 57, "category": "GPU" }
  ]
}
```

---

## Project Structure

```
security-dashboard/
├── backend/                 # Express API server (port 4000)
│   ├── src/
│   │   ├── index.js         # Main server entry
│   │   ├── checks/          # Security check modules
│   │   │   ├── temperature.js   # LHM integration
│   │   │   ├── hardware.js
│   │   │   ├── firewall.js
│   │   │   └── ...
│   │   └── ai-fix.js        # AI-powered fix suggestions
│   ├── .env                 # Environment config (create this)
│   └── package.json
├── frontend/                # Next.js dashboard (port 3000)
│   ├── app/
│   │   └── page.tsx         # Main dashboard page
│   ├── components/
│   └── package.json
├── tools/
│   └── thermal-pulse/       # Git submodule for temp monitoring
├── scripts/                 # Utility scripts
├── package.json             # Root package (runs both)
└── README.md
```

---

## Accessing from Windows

The dashboard runs in WSL2 but is accessible from Windows:

| Service | WSL2 URL | Windows URL |
|---------|----------|-------------|
| Frontend | http://localhost:3000 | http://localhost:3000 |
| Backend | http://localhost:4000 | http://localhost:4000 |

WSL2 automatically forwards ports to Windows localhost.

**From other devices on your network:**
```
http://<windows-ip>:3000
```

You may need to set up port forwarding:
```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<wsl-ip>
```

---

## Updating

### Pull Latest Changes

```bash
cd ~/projects/security-dashboard
git pull
git submodule update --remote  # Update thermal-pulse
npm install                    # In case dependencies changed
```

### Restart the Dashboard

```bash
# Kill existing processes
pkill -f "security-dashboard"

# Start fresh
npm run dev
```

---

## Troubleshooting

### Temperature shows "unavailable"

1. Is LibreHardwareMonitor running? (as Admin)
2. Is Remote Web Server enabled? (Options → Remote Web Server)
3. Is it bound to `0.0.0.0`? (not just localhost)
4. Is firewall allowing port 8085?
5. Is the `.env` configured with correct IP/credentials?

### Can't connect from WSL2 to Windows

The WSL2 gateway IP can change on restart. Update `LHM_HOST` in `.env`:
```bash
cat /etc/resolv.conf | grep nameserver
```

### Port already in use

```bash
# Find and kill the process
lsof -i :4000
kill -9 <pid>
```

---

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Temperature**: LibreHardwareMonitor + custom integration
- **Submodule**: [thermal-pulse](https://github.com/ecortez91/thermal-pulse)

---

## License

MIT
