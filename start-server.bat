@echo off
echo Запуск локального сервера для портфолио...
echo.
echo Выберите способ запуска:
echo 1. Python (рекомендуется)
echo 2. Node.js (http-server)
echo 3. PHP
echo.
set /p choice="Введите номер (1-3): "

if "%choice%"=="1" (
    echo.
    echo Запуск через Python...
    python -m http.server 8000
) else if "%choice%"=="2" (
    echo.
    echo Запуск через Node.js...
    npx http-server -p 8000
) else if "%choice%"=="3" (
    echo.
    echo Запуск через PHP...
    php -S localhost:8000
) else (
    echo Неверный выбор. Запуск через Python по умолчанию...
    python -m http.server 8000
)



