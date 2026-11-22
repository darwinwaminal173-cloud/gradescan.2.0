@echo off
title SMARTGRADE - OMR Checker App
color 0B
echo ========================================================
echo               SMARTGRADE OMR CHECKER                    
echo          Supabase Online + Camera Scanner               
echo ========================================================
echo.
echo Binubuksan ang SMARTGRADE App...
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\server.ps1"
pause
