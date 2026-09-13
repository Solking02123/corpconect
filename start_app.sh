#!/usr/bin/env bash
echo "================================================================"
echo "      تشغيل نظام إدارة الموظفين والموارد البشرية (بايثون)"
echo "================================================================"
echo ""

if ! command -v python3 &> /dev/null
then
    echo "[خطأ] لم يتم العثور على python3 على جهازك."
    echo "يرجى تثبيت بايثون: https://www.python.org/downloads/"
    exit 1
fi

echo "[✓] تشغيل التطبيق..."
python3 run_python.py
