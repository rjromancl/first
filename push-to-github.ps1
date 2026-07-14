# ─────────────────────────────────────────────────────────────────
# push-to-github.ps1
#
# Run this ONCE after creating both GitHub repos.
# Right-click → "Run with PowerShell"
# ─────────────────────────────────────────────────────────────────

$git = "C:\Program Files\Git\bin\git.exe"

# ── EDIT THESE TWO LINES with your GitHub username ────────────────
$GITHUB_USERNAME = "YOUR_GITHUB_USERNAME"
$FRONTEND_REPO   = "british-airways-frontend"
$BACKEND_REPO    = "british-airways-backend"
# ─────────────────────────────────────────────────────────────────

if ($GITHUB_USERNAME -eq "YOUR_GITHUB_USERNAME") {
    Write-Host "ERROR: Open push-to-github.ps1 and set your GitHub username first!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$frontendUrl = "https://github.com/$GITHUB_USERNAME/$FRONTEND_REPO.git"
$backendUrl  = "https://github.com/$GITHUB_USERNAME/$BACKEND_REPO.git"

Write-Host ""
Write-Host "Pushing FRONTEND to $frontendUrl ..." -ForegroundColor Cyan
Set-Location "C:\Users\2927574\Downloads\project\british-airways-app"
& $git branch -M main
& $git remote remove origin 2>$null
& $git remote add origin $frontendUrl
& $git push -u origin main

Write-Host ""
Write-Host "Pushing BACKEND to $backendUrl ..." -ForegroundColor Cyan
Set-Location "C:\Users\2927574\Downloads\project\british-airways-app\backend"
& $git branch -M main
& $git remote remove origin 2>$null
& $git remote add origin $backendUrl
& $git push -u origin main

Write-Host ""
Write-Host "Done! Both repos pushed to GitHub." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Go to https://railway.app → New Project → Deploy from GitHub → select '$BACKEND_REPO'"
Write-Host "  2. In Railway Variables tab, add: NODE_ENV=production  JWT_SECRET=<random>  PORT=4000"
Write-Host "  3. Copy your Railway URL (shown after deploy)"
Write-Host "  4. Go to https://vercel.com → New Project → Import '$FRONTEND_REPO'"
Write-Host "  5. In Vercel Environment Variables, add:"
Write-Host "       VITE_API_URL = https://<your-railway-url>/api"
Write-Host "       VITE_GEMINI_API_KEY = <your key from .env.local>"
Write-Host "  6. Deploy — Vercel gives you a public HTTPS URL to open on your phone!"
Write-Host ""
Read-Host "Press Enter to close"
