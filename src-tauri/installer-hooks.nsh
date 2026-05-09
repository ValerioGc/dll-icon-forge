!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Var RemoveAppDataCheckbox
Var RemoveAppDataSelection
Var RemoveApiKeysCheckbox
Var RemoveApiKeysSelection
Var RemovePageBodyText
Var RemoveAppDataCheckboxText
Var RemoveApiKeysCheckboxText

UninstPage custom un.RemoveAppDataPageCreate un.RemoveAppDataPageLeave

Function un.RemoveAppDataPageCreate
  ${If} $LANGUAGE == 1040
    StrCpy $RemovePageBodyText "Scegli se rimuovere anche i dati di AI Cabin salvati in AppData e le API key archiviate nel sistema."
    StrCpy $RemoveAppDataCheckboxText "Rimuovi anche impostazioni e conversazioni salvate"
    StrCpy $RemoveApiKeysCheckboxText "Rimuovi anche le API key salvate"
  ${Else}
    StrCpy $RemovePageBodyText "Choose whether to also remove AI Cabin data stored in AppData and the API keys stored in the system keychain."
    StrCpy $RemoveAppDataCheckboxText "Also remove saved settings and conversations"
    StrCpy $RemoveApiKeysCheckboxText "Also remove saved API keys"
  ${EndIf}

  nsDialogs::Create /NOUNLOAD 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 34u "$RemovePageBodyText"
  Pop $1
  SetCtlColors $1 "" transparent

  ${NSD_CreateCheckbox} 0 44u 100% 12u "$RemoveAppDataCheckboxText"
  Pop $RemoveAppDataCheckbox

  ${NSD_CreateCheckbox} 0 64u 100% 12u "$RemoveApiKeysCheckboxText"
  Pop $RemoveApiKeysCheckbox

  nsDialogs::Show
FunctionEnd

Function un.RemoveAppDataPageLeave
  ${NSD_GetState} $RemoveAppDataCheckbox $RemoveAppDataSelection
  ${NSD_GetState} $RemoveApiKeysCheckbox $RemoveApiKeysSelection
FunctionEnd

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $RemoveApiKeysSelection <> 0
    IfFileExists "$INSTDIR\ai-cabin.exe" 0 +2
      nsExec::ExecToLog '"$INSTDIR\ai-cabin.exe" --cleanup-api-keys'
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $RemoveAppDataSelection <> 0
    RMDir /r "$APPDATA\it.aicabin"
  ${EndIf}
!macroend
