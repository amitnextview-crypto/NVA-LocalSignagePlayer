#ifndef AppVersion
#define AppVersion "1.0.0"
#endif

#ifndef OutputBaseName
#define OutputBaseName "NVAPlayerPC-Setup"
#endif

[Setup]
AppId={{8E6F9941-2FE4-49A6-8A99-ED6E0101D0AB}
AppName=NVAPlayerPC
AppVersion={#AppVersion}
AppPublisher=NVAPlayerPC
AppPublisherURL=https://signageplayertv.local
AppSupportURL=https://signageplayertv.local
AppUpdatesURL=https://signageplayertv.local
DefaultDirName={localappdata}\NVAPlayerPC
DefaultGroupName=NVAPlayerPC
OutputDir=output
OutputBaseFilename={#OutputBaseName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
DisableProgramGroupPage=yes
SetupIconFile=assets\nvlogo.ico
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\nvlogo.ico
DiskSpanning=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startup"; Description: "Start NVAPlayerPC when Windows starts"; GroupDescription: "Startup options:"; Flags: checkedonce

[Files]
Source: "..\NVAPlayerPC.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\nvlogo.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\bin\yt-dlp.exe"; DestDir: "{app}\bin"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\..\android\app\build\outputs\apk\release\NVAPlayerPC.apk"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\NVAPlayerPC"; Filename: "{app}\NVAPlayerPC.exe"; IconFilename: "{app}\nvlogo.ico"; Tasks: desktopicon
Name: "{userstartup}\NVAPlayerPC"; Filename: "{app}\NVAPlayerPC.exe"; IconFilename: "{app}\nvlogo.ico"; Tasks: startup
Name: "{group}\NVAPlayerPC"; Filename: "{app}\NVAPlayerPC.exe"; IconFilename: "{app}\nvlogo.ico"
Name: "{group}\Uninstall NVAPlayerPC"; Filename: "{uninstallexe}"

[Run]
Filename: "{cmd}"; Parameters: "/C taskkill /F /IM NVAPlayerPC.exe /T >nul 2>&1"; Flags: runhidden
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall delete rule name=""NVAPlayerPC CMS"" >nul 2>&1"; Flags: runhidden waituntilterminated; Check: IsAdminInstallMode
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall delete rule name=""NVAPlayerPC CMS Port 8080"" >nul 2>&1"; Flags: runhidden waituntilterminated; Check: IsAdminInstallMode
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall add rule name=""NVAPlayerPC CMS"" dir=in action=allow program=""{app}\NVAPlayerPC.exe"" enable=yes profile=any"; Flags: runhidden waituntilterminated; Check: IsAdminInstallMode
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall add rule name=""NVAPlayerPC CMS Port 8080"" dir=in action=allow protocol=TCP localport=8080 enable=yes profile=any"; Flags: runhidden waituntilterminated; Check: IsAdminInstallMode
Filename: "{app}\NVAPlayerPC.exe"; Description: "Launch NVAPlayerPC now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /F /IM NVAPlayerPC.exe /T >nul 2>&1"; Flags: runhidden
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall delete rule name=""NVAPlayerPC CMS"" >nul 2>&1"; Flags: runhidden waituntilterminated
Filename: "{cmd}"; Parameters: "/C netsh advfirewall firewall delete rule name=""NVAPlayerPC CMS Port 8080"" >nul 2>&1"; Flags: runhidden waituntilterminated

[Code]
const
  MinFreeSpaceMB = 512;

function FormatMb(Value: Cardinal): String;
begin
  Result := IntToStr(Value) + ' MB';
end;

function HasEnoughDiskSpace(): Boolean;
var
  FreeSpaceMb: Cardinal;
  TotalSpaceMb: Cardinal;
begin
  Result :=
    GetSpaceOnDisk(ExpandConstant('{localappdata}'), True, FreeSpaceMb, TotalSpaceMb) and
    (FreeSpaceMb >= MinFreeSpaceMB);
end;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{cmd}'), '/C taskkill /F /IM NVAPlayerPC.exe /T >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if not HasEnoughDiskSpace() then begin
    SuppressibleMsgBox(
      'NVAPlayerPC install karne ke liye kam se kam ' + FormatMb(MinFreeSpaceMB) + ' free disk space chahiye in Local App Data.' + #13#10#13#10 +
      'Please thoda disk space free karke installer dubara run karein.',
      mbCriticalError,
      MB_OK,
      IDOK
    );
    Result := False;
    exit;
  end;
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    if IsAdminInstallMode then begin
      Log('Firewall rules configured for NVAPlayerPC CMS.');
    end else begin
      SuppressibleMsgBox(
        'The installer was not run in admin mode, so firewall rules were not configured automatically.' + #13#10#13#10 +
        'If CMS is not reachable from other devices, allow the app in Windows Firewall.',
        mbInformation,
        MB_OK,
        IDOK
      );
    end;
  end;
end;
