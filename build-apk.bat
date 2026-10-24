@echo off
REM Builds an installable APK on Windows using your Android Studio install.
REM Double-click this file, or run it from a terminal in the project folder.
REM First build takes 5-15 minutes; later builds are much faster.
setlocal
cd /d "%~dp0"
set CI=1

REM --- Java: use the JDK bundled with Android Studio if JAVA_HOME is not set ---
if "%JAVA_HOME%"=="" if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if "%JAVA_HOME%"=="" if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
if "%JAVA_HOME%"=="" goto :nojava

REM --- Android SDK: default Android Studio location ---
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not exist "%ANDROID_HOME%\platform-tools" goto :nosdk

echo Using Java:        %JAVA_HOME%
echo Using Android SDK: %ANDROID_HOME%
echo.

echo [1/3] Installing packages...
call npm install || goto :fail

echo [2/3] Generating the Android project...
call npx expo prebuild -p android --no-install || goto :fail

echo [3/3] Building the APK...
pushd android
call gradlew.bat assembleRelease || (popd & goto :fail)
popd

copy /Y "android\app\build\outputs\apk\release\app-release.apk" "ShadowPatternMatcher.apk" >nul || goto :fail
echo.
echo Done. Your APK is here:
echo   %CD%\ShadowPatternMatcher.apk
echo Copy it to your Android phone and open it to install.
pause
exit /b 0

:nojava
echo Java was not found. Install Android Studio, open it once, then run this again.
pause
exit /b 1

:nosdk
echo Android SDK was not found at %ANDROID_HOME%.
echo Open Android Studio, go to Settings, Languages and Frameworks, Android SDK,
echo install the latest SDK, then run this again.
pause
exit /b 1

:fail
echo.
echo The build stopped with an error. Scroll up to see the first red error message.
pause
exit /b 1
