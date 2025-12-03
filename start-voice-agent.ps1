# Script para iniciar el agente de voz localmente

Write-Host "🎙️ Iniciando Agente de Voz - Kipu" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar API Key
Write-Host "1️⃣ Verificando API Key..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    $apiKey = Get-Content "backend\.env" | Select-String "GEMINI_API_KEY"
    if ($apiKey) {
        Write-Host "   ✅ API Key configurada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ API Key no encontrada en .env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ❌ Archivo .env no encontrado" -ForegroundColor Red
    exit 1
}

# 2. Compilar backend
Write-Host ""
Write-Host "2️⃣ Compilando backend..." -ForegroundColor Yellow
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Error al compilar" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "   ✅ Backend compilado" -ForegroundColor Green
Set-Location ..

# 3. Iniciar backend
Write-Host ""
Write-Host "3️⃣ Iniciando servidor backend..." -ForegroundColor Yellow
Write-Host "   📡 Puerto: 10000" -ForegroundColor Cyan
Write-Host "   🔌 WebSocket: ws://localhost:10000/voice" -ForegroundColor Cyan
Write-Host ""

Set-Location backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal

# Esperar a que el servidor inicie
Start-Sleep -Seconds 3

# 4. Iniciar frontend
Write-Host ""
Write-Host "4️⃣ Iniciando frontend..." -ForegroundColor Yellow
Set-Location ..
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Sistema iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Abre tu navegador en: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🎙️ Ve a una grabación y click en la pestaña 'Voz'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para detener: Cierra las ventanas de PowerShell" -ForegroundColor Yellow
