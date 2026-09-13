@echo off
title CorpConnect Server
echo Starting CorpConnect...
echo.
if not exist node_modules (
    echo [ERROR] node_modules not found. Please run setup.bat first.
    pause
    exit
)
npm run dev
pause
