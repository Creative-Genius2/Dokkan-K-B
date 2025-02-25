# MCP Complete Setup and Management
# Save as 'manage-mcp.ps1'

$ErrorActionPreference = "Stop"

# Paths
$rootPath = "$env:APPDATA\Claude"
$mcpPath = "$rootPath\dokkan-mcp"
$logsPath = "$rootPath\logs"
$dataPath = "$mcpPath\data"
$claudeDesktopPath = "C:\Users\prado\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

function Initialize-MCP {
    Write-Log "Initializing MCP..."
    
    # Create directories
    @($mcpPath, $logsPath, $dataPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force
            Write-Log "Created directory: $_"
        }
    }
    
    # Check for running processes
    Get-Process "Claude Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*server.js*"
    } | Stop-Process -Force
    
    # Create log file
    $logFile = "$logsPath\mcp.log"
    if (-not (Test-Path $logFile)) {
        New-Item -ItemType File -Path $logFile -Force
        Write-Log "Created log file"
    }
    
    # Install dependencies
    Set-Location $mcpPath
    npm install
    Write-Log "Installed dependencies"
}

function Start-MCP {
    Write-Log "Starting MCP..."
    
    # Kill any existing node processes
    Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*server.js*"
    } | ForEach-Object {
        Write-Log "Killing existing node process: $($_.Id)"
        Stop-Process -Id $_.Id -Force
    }
    
    # Wait for port to be free
    Start-Sleep -Seconds 2
    
    # Start server
    Set-Location $mcpPath
    Start-Process node -ArgumentList "server.js" -NoNewWindow
    Write-Log "Started MCP server"
    
    # Start Claude Desktop
    Start-Sleep -Seconds 2
    if (Test-Path $claudeDesktopPath) {
        Start-Process $claudeDesktopPath
        Write-Log "Started Claude Desktop"
    } else {
        Write-Log "Warning: Could not find Claude Desktop at $claudeDesktopPath"
    }
    Write-Log "Started Claude Desktop"
}

function Reset-MCP {
    Write-Log "Resetting MCP..."
    
    # Stop processes
    Get-Process "Claude Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*server.js*"
    } | Stop-Process -Force
    
    # Clear cache
    Remove-Item "$mcpPath\data\*" -Force -Recurse
    Remove-Item "$logsPath\mcp.log" -Force
    Write-Log "Cleared cache and logs"
    
    # Restart
    Initialize-MCP
    Start-MCP
    Write-Log "MCP reset complete"
}

function Test-MCP {
    Write-Log "Testing MCP..."
    
    # Test endpoints
    $tests = @(
        @{url="http://localhost:3000/health"; name="Health check"},
        @{url="http://localhost:3000/scan/status"; name="Scanner status"}
    )
    
    foreach ($test in $tests) {
        try {
            $response = Invoke-WebRequest -Uri $test.url -Method GET
            Write-Log "$($test.name): OK"
        } catch {
            Write-Log "$($test.name): Failed - $($_.Exception.Message)"
        }
    }
}

# Command line interface
$command = $args[0]
switch ($command) {
    "init" { Initialize-MCP }
    "start" { Start-MCP }
    "reset" { Reset-MCP }
    "test" { Test-MCP }
    default {
        Write-Log @"
MCP Management Script
Commands:
- init  : Initialize MCP
- start : Start MCP and Claude Desktop
- reset : Reset MCP and clear cache
- test  : Test MCP endpoints
"@
    }
}