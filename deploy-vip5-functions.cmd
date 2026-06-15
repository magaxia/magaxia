@echo off
setlocal

cd /d "%~dp0"

echo.
echo === VIP5 Firebase Functions Deploy ===
echo Pasta: %CD%
echo.

if not exist firebase.json (
  echo ERRO: firebase.json nao encontrado nesta pasta.
  echo Abra este arquivo dentro da pasta do projeto.
  exit /b 1
)

echo Testando acesso ao Firebase Auth...
curl.exe -I --connect-timeout 15 https://auth.firebase.tools/ >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRO: este computador/rede nao consegue acessar https://auth.firebase.tools/
  echo Troque de rede, use hotspot/VPN, ou libere o Firebase no firewall/antivirus.
  echo Depois rode este arquivo novamente.
  exit /b 1
)

echo.
echo Verificando login Firebase...
firebase.cmd login:list >nul 2>&1
if errorlevel 1 (
  echo.
  echo Voce ainda nao esta logado no Firebase.
  echo Abrindo login agora...
  firebase.cmd login --reauth --no-localhost
  if errorlevel 1 (
    echo.
    echo ERRO: login Firebase falhou. O deploy nao pode continuar sem autenticar.
    exit /b 1
  )
)

echo.
echo Publicando vip5Activate e vip5ActivateHttp...
firebase.cmd deploy --only functions:vip5Activate,functions:vip5ActivateHttp --project vastbitloud-2872a
if errorlevel 1 (
  echo.
  echo ERRO: deploy falhou.
  exit /b 1
)

echo.
echo Deploy concluido com sucesso.
endlocal
