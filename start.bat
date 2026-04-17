@echo off
REM RunaNet display launcher (Windows) — thin wrapper around start.py.
REM Usage: start.bat [--no-fullscreen] [--build] [--debug] [--no-presence]
cd /d "%~dp0"
python start.py %*
exit /b %ERRORLEVEL%
