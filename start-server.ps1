# Скрипт для запуска локального сервера портфолио
Write-Host "Запуск локального сервера для портфолио..." -ForegroundColor Green
Write-Host ""

# Проверяем, какой способ доступен
$pythonAvailable = Get-Command python -ErrorAction SilentlyContinue
$nodeAvailable = Get-Command node -ErrorAction SilentlyContinue
$phpAvailable = Get-Command php -ErrorAction SilentlyContinue

Write-Host "Доступные способы запуска:" -ForegroundColor Yellow
if ($pythonAvailable) { Write-Host "  1. Python (python -m http.server)" }
if ($nodeAvailable) { Write-Host "  2. Node.js (npx http-server)" }
if ($phpAvailable) { Write-Host "  3. PHP (php -S)" }
Write-Host ""

# Автоматически выбираем первый доступный вариант
if ($pythonAvailable) {
    Write-Host "Запуск через Python на http://localhost:8000" -ForegroundColor Cyan
    Write-Host "Откройте в браузере: http://localhost:8000" -ForegroundColor Yellow
    Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Gray
    Write-Host ""
    python -m http.server 8000
}
elseif ($nodeAvailable) {
    Write-Host "Запуск через Node.js на http://localhost:8000" -ForegroundColor Cyan
    Write-Host "Откройте в браузере: http://localhost:8000" -ForegroundColor Yellow
    Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Gray
    Write-Host ""
    npx http-server -p 8000
}
elseif ($phpAvailable) {
    Write-Host "Запуск через PHP на http://localhost:8000" -ForegroundColor Cyan
    Write-Host "Откройте в браузере: http://localhost:8000" -ForegroundColor Yellow
    Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Gray
    Write-Host ""
    php -S localhost:8000
}
else {
    Write-Host "Ошибка: Не найдено ни Python, ни Node.js, ни PHP!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Установите один из них:" -ForegroundColor Yellow
    Write-Host "  - Python: https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  - Node.js: https://nodejs.org/" -ForegroundColor White
    Write-Host "  - PHP: https://www.php.net/downloads.php" -ForegroundColor White
    pause
}



