@echo off
chcp 65001 > nul
title أداة تحويل تطبيق CorpConnect إلى ملف EXE مباشر
cls
echo ================================================================
echo       أداة بناء ملف EXE لنظام إدارة الموظفين CorpConnect
echo ================================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على بايثون مثبت على جهازك!
    echo يلزم وجود بايثون لمرة واحدة فقط لإنشاء ملف الـ EXE:
    echo https://www.python.org/downloads/
    echo وتأكد من تحديد خيار "Add Python to PATH" أثناء التثبيت.
    echo.
    pause
    exit /b
)

echo [1/3] التحقق من أداة PyInstaller وتثبيتها...
python -m pip install --upgrade pyinstaller
if %errorlevel% neq 0 (
    echo [تنبيه] محاولة التثبيت عبر pip المباشر...
    pip install pyinstaller
)

echo.
echo [2/3] جاري تجميع وتحويل البرنامج إلى ملف تشغيلي EXE مستقل...
echo يرجى الانتظار، قد يستغرق ذلك دقيقة واحدة فقط...
echo.

pyinstaller --noconfirm --onefile --name "CorpConnect" run_python.py

if %errorlevel% neq 0 (
    echo.
    echo [فشل] حدث خطأ أثناء بناء ملف الـ EXE. تأكد من اتصال الإنترنت لتثبيت pyinstaller.
    echo.
    pause
    exit /b
)

echo.
echo ================================================================
echo [✓] تم إنشاء ملف الـ EXE بنجاح تام!
echo ================================================================
echo.
echo ستجد ملف البرنامج المستقل داخل مجلد "dist":
echo 👉 dist\CorpConnect.exe
echo.
echo يمكنك الآن نسخ ملف CorpConnect.exe وتشغيله على أي جهاز كمبيوتر
echo دون الحاجة لتثبيت بايثون أو أي برامج أخرى!
echo.
pause
