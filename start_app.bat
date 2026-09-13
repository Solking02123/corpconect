@echo off
chcp 65001 > nul
title تشغيل نظام CorpConnect لإدارة الموظفين (بايثون)
cls
echo ================================================================
echo       تشغيل نظام إدارة الموظفين والموارد البشرية (بايثون)
echo ================================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على لغة بايثون مثبتة على جهازك!
    echo يرجى تحميل وتثبيت بايثون من الموقع الرسمي: https://www.python.org/downloads/
    echo وتأكد من تحديد خيار "Add Python to PATH" أثناء التثبيت.
    echo.
    pause
    exit /b
)

echo [✓] تم التحقق من وجود بايثون.
echo [✓] تشغيل التطبيق وقاعدة البيانات محلياً...
echo.
echo سيتم فتح المتصفح تلقائياً على الرابط: http://localhost:8000
echo.
python run_python.py

pause
