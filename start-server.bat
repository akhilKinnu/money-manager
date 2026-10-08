@echo off
title FinTrack Pro - Local Web Server (Google OAuth Ready)
echo ====================================================================
echo   FinTrack Pro - Local Web Server for Google OAuth & Gmail Sync
echo ====================================================================
echo.
echo Starting server at http://localhost:8080 ...
echo (Leave this window open while using Google Sign-in / Gmail Sync)
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
