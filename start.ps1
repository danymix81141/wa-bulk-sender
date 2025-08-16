# Questo file contiene lo script PowerShell finale e ottimizzato.
#
# COME USARLO:
# 1. Copia tutto il testo contenuto tra i backtick (`) qui sotto.
# 2. Incolla il testo in un nuovo file e salvalo con il nome `start.ps1`,
#    sostituendo la versione precedente.
# 3. Esegui il file `start.ps1` da un terminale PowerShell.

const powershellScript = `
# ==============================================================================
#      SCRIPT DI AVVIO OTTIMIZZATO PER WA BULK SENDER (POWERSHELL)
# ==============================================================================
#
# DESCRIZIONE:
# Questo script controlla se le dipendenze sono già installate.
# - Se NON lo sono, le installa.
# - Se lo SONO già, avvia direttamente il server per la massima velocità.
#
# ==============================================================================

# --- Inizio dello Script ---
$ErrorActionPreference = 'Stop'
try {
    if ($PSScriptRoot) {
        Set-Location $PSScriptRoot
    }
}
catch {
    Write-Host "Impossibile cambiare directory." -ForegroundColor Yellow
}

Write-Host "Avvio dell'applicazione WA Bulk Sender..." -ForegroundColor Green

# 1. Controlla se npm è disponibile
$npmExists = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmExists) {
    Write-Host "ERRORE: npm non è stato trovato. Installa Node.js." -ForegroundColor Red
    if ($Host.Name -eq "ConsoleHost") { Read-Host "Premi Invio per uscire" }
    exit 1
}

# 2. Installa le dipendenze solo se necessario
if (-not (Test-Path "node_modules")) {
    Write-Host "'node_modules' non trovata. Installazione delle dipendenze..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRORE: 'npm install' non è riuscito." -ForegroundColor Red
        if ($Host.Name -eq "ConsoleHost") { Read-Host "Premi Invio per uscire" }
        exit 1
    }
}

# 3. Avvia il server
Write-Host "Avvio del server... (Premi CTRL+C per fermare)"
npm start
if ($LASTEXITCODE -ne 0) {
    Write-Host "Il processo del server si è chiuso con un errore." -ForegroundColor Red
     if ($Host.Name -eq "ConsoleHost") {
        Read-Host "Premi Invio per uscire"
    }
}
`;

# Questo file è un modulo TypeScript valido ma non esegue alcuna azione se lanciato con Node.js.
# Il suo unico scopo è contenere il testo dello script PowerShell.
console.log("Questo file contiene uno script PowerShell. Per usarlo, copia il contenuto della costante 'powershellScript' in un nuovo file 'start.ps1' ed eseguilo.");