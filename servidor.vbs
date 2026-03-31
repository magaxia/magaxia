Dim objWMIService, colItems, objItem
Dim objHTTP, objShell, objWSH
Dim strPath, strPort

strPath = "c:\Users\Kalebi\Downloads"
strPort = 8000

Set objShell = CreateObject("WScript.Shell")
Set objWSH = WScript.CreateObject("WScript.Shell")

' Inicia servidor HTTP com Node.js http-server
On Error Resume Next

' Tenta com npx (npm)
objShell.Run "npx http-server " & strPath & " -p " & strPort & " -o", 1, False

If Err.Number <> 0 Then
    MsgBox "Erro ao iniciar servidor" & vbCrLf & Err.Description, vbCritical
End If

WScript.Quit
