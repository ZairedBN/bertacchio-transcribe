# Lancia i test nel browser vero (Edge headless) contro il sito.
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\test\run.ps1                 # tutte le suite, server locale
#   powershell -ExecutionPolicy Bypass -File tools\test\run.ps1 -Suite keys,i18n
#   powershell -ExecutionPolicy Bypass -File tools\test\run.ps1 -Url https://zairedbn.github.io/bertacchio-transcribe/
# Il server locale deve essere acceso (server.ps1, porta 8765) se si usa l'URL predefinito.
# Ogni suite parte con un profilo Edge pulito; gli screenshot vanno in tools\test\out\.
param(
  [string[]]$Suite = @('functional', 'offline', 'mobile', 'keys', 'markers', 'countin', 'countsync', 'startpos', 'linkerr', 'sections', 'mixer', 'i18n', 'autolang', 'polish', 'bpmoct'),
  [string]$Url = 'http://localhost:8765/'
)
$Suite = $Suite | ForEach-Object { $_ -split "," } | Where-Object { $_ }   # con -File le virgole arrivano in un solo testo
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 9500
foreach ($s in $Suite) {
  $json = Join-Path $here "suite-$s.json"
  if (-not (Test-Path $json)) { "== ${s}: suite non trovata"; continue }
  $edgeDir = Join-Path $env:TEMP "bt-edge-$s"
  if (Test-Path $edgeDir) { Remove-Item -Recurse -Force $edgeDir -ErrorAction SilentlyContinue }
  "== $s"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here 'cdp.ps1') -Port $port -Url $Url -Commands $json -UserDir $edgeDir
  $port++
}
