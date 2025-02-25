# fix-mcp.ps1
$ErrorActionPreference = "Stop"

# Paths
$rootPath = "$env:APPDATA\Claude\dokkan-mcp"
$logsPath = "$env:APPDATA\Claude\logs"
$dataPath = "$rootPath\data"

# Function to log with timestamp
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

# Check and create directories
Write-Log "Creating directories..."
@($rootPath, $logsPath, $dataPath) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force
        Write-Log "Created directory: $_"
    }
}

# Create/verify log file
Write-Log "Setting up log file..."
$logFile = "$logsPath\mcp.log"
if (-not (Test-Path $logFile)) {
    New-Item -ItemType File -Path $logFile -Force
    Write-Log "Created mcp.log"
}

# Create/update package.json
Write-Log "Creating package.json..."
$packageJson = @{
    name = "dokkan-mcp"
    version = "1.0.0"
    dependencies = @{
        express = "^4.17.1"
        "node-fetch" = "^2.6.1"
        cheerio = "^1.0.0-rc.10"
    }
} | ConvertTo-Json
Set-Content -Path "$rootPath\package.json" -Value $packageJson

# Install dependencies
Write-Log "Installing dependencies..."
Set-Location $rootPath
npm install

# Reset Claude Desktop (if running)
Write-Log "Resetting Claude Desktop..."
$claudeProcess = Get-Process "Claude Desktop" -ErrorAction SilentlyContinue
if ($claudeProcess) {
    $claudeProcess | Stop-Process -Force
    Write-Log "Stopped Claude Desktop"
    Start-Sleep -Seconds 2
    Start-Process "$env:LOCALAPPDATA\Programs\Claude Desktop\Claude Desktop.exe"
    Write-Log "Restarted Claude Desktop"
}

# Stop any running node processes
Write-Log "Cleaning up node processes..."
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*server.js*"
} | Stop-Process -Force

# Start MCP server
Write-Log "Starting MCP server..."
Start-Process node -ArgumentList "server.js" -NoNewWindow

Write-Log "Fix complete! MCP server started and Claude Desktop reset."