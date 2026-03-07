[Setup]
AppId={{8E6F9941-2FE4-49A6-8A99-ED6E0101D0AB}
AppName=Signage CMS
AppVersion=1.0.0
AppPublisher=SignagePlayerTV
AppPublisherURL=https://signageplayertv.local
AppSupportURL=https://signageplayertv.local
AppUpdatesURL=https://signageplayertv.local
DefaultDirName={localappdata}\NVA SignagePlayerTV
DefaultGroupName=NVA SignagePlayerTV
OutputDir=output
OutputBaseFilename=NVA-SignagePlayerTV-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
SetupIconFile=assets\nvlogo.ico

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startup"; Description: "Start Signage CMS when Windows starts"; GroupDescription: "Startup options:"

[Files]
Source: "..\NVA-SignagePlayerTV.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\nvlogo.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\android\app\build\outputs\apk\release\NVA-SignagePlayerTV.apk"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\NVA SignagePlayerTV"; Filename: "{app}\NVA-SignagePlayerTV.exe"; IconFilename: "{app}\nvlogo.ico"; Tasks: desktopicon
Name: "{userstartup}\NVA SignagePlayerTV"; Filename: "{app}\NVA-SignagePlayerTV.exe"; IconFilename: "{app}\nvlogo.ico"; Tasks: startup
Name: "{group}\NVA SignagePlayerTV"; Filename: "{app}\NVA-SignagePlayerTV.exe"; IconFilename: "{app}\nvlogo.ico"
Name: "{group}\Uninstall NVA SignagePlayerTV"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\NVA-SignagePlayerTV.exe"; Description: "Launch NVA SignagePlayerTV now"; Flags: nowait postinstall skipifsilent
