@echo off
title Bertacchio Transcribe
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo Il looper si e' chiuso con un errore. Leggi il messaggio qui sopra.
  echo The looper closed with an error. Read the message above.
  pause
)
