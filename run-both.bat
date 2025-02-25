@echo off
setlocal enabledelayedexpansion
echo ===== Dokkan MCP: Starting Both Servers with Claude Desktop Integration =====
echo.

REM Check if Claude Desktop is already running
tasklist /FI "IMAGENAME eq Claude.exe" 2>NUL | find /I /N "Claude.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Claude Desktop is already running. Will restart it later.
    set CLAUDE_RUNNING=1
) else (
    echo Claude Desktop is not currently running.
    set CLAUDE_RUNNING=0
)

echo Step 1: Clearing port 3000 (required for Claude Desktop)
call node restart.js
echo.

echo Step 2: Starting server.js for Claude Desktop
start "Dokkan MCP Server" /min cmd /c "mode con: cols=100 lines=30 & color 0A & node server.js"
set SERVER_PID=
for /f "tokens=2" %%a in ('tasklist /v ^| findstr "Dokkan MCP Server"') do (
    set SERVER_PID=%%a
    goto :found_server
)
:found_server
echo Server started with PID: !SERVER_PID!
echo.

echo Step 3: Checking if server.js initialized properly...
timeout /t 2 /nobreak > nul

REM Check if the server is running properly on port 3000
set PORT_CHECK=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000') do (
    set PORT_CHECK=1
)

if "!PORT_CHECK!"=="0" (
    echo [WARNING] Server.js does not appear to be running on port 3000.
    echo This may cause connection issues with Claude Desktop.
    echo.
    choice /C YN /M "Do you want to continue anyway?"
    if !ERRORLEVEL! EQU 2 goto :cleanup
) else (
    echo Server is running properly on port 3000.
)
echo.

echo Step 4: Starting setup.js on alternate port
start "Dokkan MCP Setup" /min cmd /c "mode con: cols=100 lines=30 & color 0B & node setup.js"
echo.

echo Step 5: Verifying connections...
echo Testing server health endpoint...
curl -s -o "%TEMP%\health_response.txt" http://localhost:3000/health
set CURL_RESULT=%ERRORLEVEL%

if %CURL_RESULT% NEQ 0 (
    echo [CRITICAL] Server health check failed! Server not responding.
    echo This will prevent Claude Desktop from connecting.
    goto :connection_failure
) else (
    echo ✓ Server responding to health requests.
)

REM Test if health response contains expected fields
findstr "status" "%TEMP%\health_response.txt" > nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Health response doesn't contain status field.
    goto :connection_failure
) else (
    echo ✓ Health response format valid.
)

REM Test initialize endpoint - the most critical for Claude Desktop
echo Testing initialize endpoint (critical for Claude Desktop)...
echo {"jsonrpc":"2.0","method":"initialize","params":{},"id":1} > "%TEMP%\init_request.json"
curl -s -o "%TEMP%\init_response.txt" -X POST -H "Content-Type: application/json" -d @"%TEMP%\init_request.json" http://localhost:3000/
set CURL_RESULT=%ERRORLEVEL%

if %CURL_RESULT% NEQ 0 (
    echo [CRITICAL] Initialize request failed! Claude Desktop will not connect.
    goto :connection_failure
)

REM Check if initialize response contains protocol version
findstr "protocolVersion" "%TEMP%\init_response.txt" > nul
if %ERRORLEVEL% NEQ 0 (
    echo [CRITICAL] Initialize response doesn't contain protocol version!
    echo This is a common cause of Error Code 4 in Claude Desktop.
    goto :connection_failure
) else (
    echo ✓ Initialize protocol response valid.
)

echo All connection tests passed! Claude Desktop should connect properly.
goto :connection_success

:connection_failure
echo.
echo ==================== CONNECTION DIAGNOSTIC ===================
echo A connection issue was detected. Here are possible causes:
echo.
echo 1. Protocol version mismatch
echo    - Claude Desktop expects "2024-02-24"
echo    - Check initialize() response in server.js
echo.
echo 2. JSON-RPC format error (Error Code 4)
echo    - Responses must follow {"jsonrpc":"2.0","result":{...},"id":1}
echo    - Check response formatting in server.js
echo.
echo 3. CORS or header issues
echo    - Claude Desktop requires proper CORS headers
echo    - Run node fix-initialize.js to correct this
echo.
echo 4. Port binding not complete
echo    - Port 3000 might not be fully bound
echo    - Try restarting with administrator rights
echo.
echo 5. Response timeout
echo    - Server might be responding too slowly
echo    - Check for long operations in handlers
echo.
echo The detailed technical response was saved to:
echo %TEMP%\health_response.txt and %TEMP%\init_response.txt
echo.
echo Would you like to try running node fix-initialize.js to correct common issues?
choice /C YN /M "Run fix-initialize.js now"
if !ERRORLEVEL! EQU 1 (
    echo Running fix-initialize.js...
    node fix-initialize.js
    echo.
    echo Restarting server.js with fixes...
    taskkill /FI "WINDOWTITLE eq Dokkan MCP Server*" /F >NUL 2>&1
    timeout /t 1 /nobreak > nul
    start "Dokkan MCP Server" /min cmd /c "mode con: cols=100 lines=30 & color 0A & node server.js"
    echo Waiting for server to restart...
    timeout /t 5 /nobreak > nul
    echo Server restarted. Proceed to launch Claude Desktop.
)

:connection_success
echo.

echo ===== Servers started successfully =====
echo.
echo Step 6: Start Claude Desktop automatically?
choice /C YN /M "Would you like to start Claude Desktop now"
if !ERRORLEVEL! EQU 1 (
    echo Starting Claude Desktop...
    
    REM Check if Claude Desktop is installed in common locations or available as a shortcut
    set CLAUDE_PATH=
    if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (
        set CLAUDE_PATH="%LOCALAPPDATA%\Programs\Claude\Claude.exe"
    ) else if exist "C:\Program Files\Claude\Claude.exe" (
        set CLAUDE_PATH="C:\Program Files\Claude\Claude.exe"
    ) else if exist "C:\Program Files (x86)\Claude\Claude.exe" (
        set CLAUDE_PATH="C:\Program Files (x86)\Claude\Claude.exe"
    ) else if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk" (
        set CLAUDE_PATH="%APPDATA%\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"
    )
    
    if not "!CLAUDE_PATH!"=="" (
        start "" !CLAUDE_PATH!
        echo Claude Desktop started successfully.
    ) else (
        echo [ERROR] Could not find Claude Desktop executable.
        echo Please start Claude Desktop manually.
    )
)

echo.
echo Server.js is running on port 3000 (Claude Desktop connection)
echo Setup.js is running on port 3001+ (Wiki updater and utilities)
echo.
echo Press any key to cleanly stop all servers and restart Claude Desktop...
pause > nul

:cleanup
echo.
echo ===== Cleaning up =====
echo.

echo Stopping server.js...
if defined SERVER_PID (
    taskkill /PID !SERVER_PID! /F >NUL 2>&1
    echo Server.js stopped successfully.
) else (
    echo Could not find server.js process to stop.
)

echo Closing all Dokkan MCP windows...
taskkill /FI "WINDOWTITLE eq Dokkan MCP*" /F >NUL 2>&1

echo Clearing port 3000 again...
call node restart.js >NUL 2>&1

if "!CLAUDE_RUNNING!"=="1" (
    echo Restarting Claude Desktop...
    echo 1. Terminating any running Claude Desktop instances
    taskkill /IM Claude.exe /F >NUL 2>&1
    timeout /t 3 /nobreak > nul
    
    echo 2. Starting Claude Desktop using shortcut...
    
    REM Try different possible shortcut locations
    set CLAUDE_FOUND=0
    
    if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk" (
        echo Using Start Menu shortcut...
        start "" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"
        set CLAUDE_FOUND=1
    ) else if exist "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk" (
        echo Using common Start Menu shortcut...
        start "" "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"
        set CLAUDE_FOUND=1
    ) else if exist "%APPDATA%\Roaming\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk" (
        echo Using Roaming shortcut...
        start "" "%APPDATA%\Roaming\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"
        set CLAUDE_FOUND=1
    ) else if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (
        echo Using executable path...
        start "" "%LOCALAPPDATA%\Programs\Claude\Claude.exe"
        set CLAUDE_FOUND=1
    ) else (
        REM Try to find Claude.exe anywhere on the system
        for /f "tokens=*" %%i in ('where /r C:\ Claude.exe 2^>nul') do (
            if exist "%%i" (
                echo Found Claude.exe at: %%i
                start "" "%%i"
                set CLAUDE_FOUND=1
                goto :claude_started
            )
        )
    )
    
    :claude_started
    if "!CLAUDE_FOUND!"=="1" (
        echo Claude Desktop restart initiated.
    ) else (
        echo [ERROR] Could not find Claude Desktop.
        echo Please restart Claude Desktop manually.
    )
) else (
    echo Claude Desktop was not running before, not restarting.
)

echo.
echo Done! All processes have been cleaned up.
timeout /t 3 > nul
endlocal