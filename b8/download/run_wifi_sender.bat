@echo off
REM Get the path to the sender script in the same directory
set "psScript="%~dp0sender_client.ps1""

echo Running the PowerShell Client Sender...

REM Execute the PowerShell script with the Bypass Execution Policy
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File %psScript%

pause