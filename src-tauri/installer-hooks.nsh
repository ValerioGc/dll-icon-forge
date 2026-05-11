!include "LogicLib.nsh"

; Post-uninstall hook: remove app data from AppData if the user opted in.
; The bundle identifier must match tauri.conf.json > identifier.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    RMDir /r "$APPDATA\it.valeriogc.dlliconforge"
    RMDir /r "$LOCALAPPDATA\it.valeriogc.dlliconforge"
  ${EndIf}
!macroend
