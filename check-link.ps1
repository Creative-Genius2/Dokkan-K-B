# Check symlink and paths
$symlinkPath = "C:\Users\prado\AppData\Local\AnthropicClaude\app-0.7.9\server.js"
$sourcePath = "C:\Users\prado\AppData\Roaming\Claude\dokkan-mcp\server.js"

if (Test-Path $symlinkPath) {
    $item = Get-Item $symlinkPath
    Write-Host "Symlink exists: $($item.LinkType)"
    Write-Host "Target: $($item.Target)"
} else {
    Write-Host "Symlink does not exist"
}

if (Test-Path $sourcePath) {
    Write-Host "Source file exists"
} else {
    Write-Host "Source file missing"
}