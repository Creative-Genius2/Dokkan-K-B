# setup.ps1
$ErrorActionPreference = "Stop"

# Define paths
$mcpDir = "$env:APPDATA\Claude\dokkan-mcp"
$logPath = Join-Path $mcpDir "setup-log.txt"

function Write-ToLog {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    $logMessage | Add-Content $logPath
    Write-Host $Message
}

# Create directories
New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Starting setup..." | Set-Content $logPath

# Kill existing processes
Write-ToLog "Stopping existing processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 2

# Create server.js
$serverJs = @'
const express = require("express");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
});

// Dokkan info scraping
app.get("/dokkan/card/:id", async (req, res) => {
    try {
        const response = await fetch(`https://dokkaninfo.com/cards/${req.params.id}`);
        const html = await response.text();
        const $ = cheerio.load(html);
        
        res.json({
            name: $(".card-name").text().trim(),
            type: $(".card-type").text().trim(),
            stats: {
                hp: $(".stat-hp").text().trim(),
                atk: $(".stat-atk").text().trim(),
                def: $(".stat-def").text().trim()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fandom wiki API
app.get("/wiki/card/:id", async (req, res) => {
    try {
        const params = new URLSearchParams({
            action: "query",
            prop: "revisions",
            rvprop: "content",
            format: "json",
            titles: `Card:${req.params.id}`
        });

        const response = await fetch(
            `https://dbz-dokkanbattle.fandom.com/api.php?${params}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}).on("error", (err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
});
'@
Set-Content -Path (Join-Path $mcpDir "server.js") -Value $serverJs
Write-ToLog "Created server.js"

# Create package.json
$packageJson = @{
    name = "dokkan-mcp"
    version = "1.0.0"
    dependencies = @{
        express = "^4.17.1"
        cheerio = "^1.0.0-rc.10"
        "node-fetch" = "^2.6.1"
    }
} | ConvertTo-Json
Set-Content -Path (Join-Path $mcpDir "package.json") -Value $packageJson
Write-ToLog "Created package.json"

# Install dependencies
Set-Location $mcpDir
npm install
Write-ToLog "Installed dependencies"

# Create Claude Desktop config
Write-ToLog "Creating Claude Desktop config..."
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$config = @{
    mcpServers = @{
        "dokkan-mcp" = @{
            command = "node"
            args = @("server.js")
            env = @{
                PORT = "3000"
            }
        }
    }
} | ConvertTo-Json
Set-Content -Path $configPath -Value $config

# Start server
Write-ToLog "Starting server..."
$nodeProcess = Start-Process node -ArgumentList "server.js" -NoNewWindow -PassThru

# Wait and verify
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest "http://localhost:3000/health"
    if ($response.StatusCode -eq 200) {
        Write-ToLog "Server running successfully"
    }
} catch {
    Write-ToLog "Server failed to start: $($_.Exception.Message)"
    exit 1
}

# Start Claude Desktop
Write-ToLog "Starting Claude Desktop..."
$claudePath = "C:\Users\prado\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"
if (Test-Path $claudePath) {
    Start-Process $claudePath
    Write-ToLog "Claude Desktop started"
} else {
    Write-ToLog "WARNING: Claude Desktop shortcut not found at: $claudePath"
}

Write-ToLog "Setup complete!"