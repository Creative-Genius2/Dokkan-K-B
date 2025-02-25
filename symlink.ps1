# Must be run as administrator
$source = "C:\Users\prado\AppData\Roaming\Claude\dokkan-mcp\server.js"
$target = "C:\Users\prado\AppData\Local\AnthropicClaude\app-0.7.9\server.js"

# Create target directory if it doesn't exist
$targetDir = Split-Path -Parent $target
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir
}

# Create symbolic link
New-Item -ItemType SymbolicLink -Path $target -Target $source -Force

Write-Host "Symlink created from $source to $target"