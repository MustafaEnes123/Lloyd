#!/usr/bin/env bash
# ============================================================================
# PROJECT LLOYD V2 — PORTABLE ZERO-CONFIG macOS .APP & DRAG-AND-DROP .DMG
# Packages Lloyd into a lightweight .dmg installer (<5 MB, zero 1GB+ models
# bundled inside the binary), with an /Applications drag-and-drop symlink and
# automatic ~/Library/Application Support/Lloyd/models provisioning.
# ============================================================================
set -euo pipefail

PROJECT_ROOT="/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
DIST_DIR="${PROJECT_ROOT}/dist"
STAGING_DIR="${DIST_DIR}/dmg_staging"
APP_NAME="Lloyd"
APP_BUNDLE="${DIST_DIR}/${APP_NAME}.app"
DMG_PATH="${DIST_DIR}/${APP_NAME}-macOS-arm64.dmg"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

echo "=================================================================="
echo "  PACKAGING PROJECT LLOYD V2 -> PORTABLE macOS .APP & .DMG"
echo "  Repository: https://github.com/MustafaEnes123/Lloyd"
echo "  License   : MIT License (Mustafa Enes Kayaci / Enes)"
echo "=================================================================="

# 1. Build production Vite + React + Three.js frontend
echo "[1/5] Building production Neural Expressive 3D frontend..."
cd "${FRONTEND_DIR}"
npm run build

# 2. Construct macOS .app bundle hierarchy (without 1.1GB model binaries)
echo "[2/5] Assembling lightweight ${APP_BUNDLE} bundle..."
rm -rf "${APP_BUNDLE}" "${STAGING_DIR}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources/backend"
mkdir -p "${APP_BUNDLE}/Contents/Resources/frontend/dist"

# Copy backend Python daemon sources & frontend build into Resources
cp "${BACKEND_DIR}"/*.py "${BACKEND_DIR}/requirements.txt" "${APP_BUNDLE}/Contents/Resources/backend/"
cp -R "${FRONTEND_DIR}/dist/"* "${APP_BUNDLE}/Contents/Resources/frontend/dist/"
cp "${PROJECT_ROOT}/LICENSE" "${APP_BUNDLE}/Contents/Resources/"

# Ensure ~/Library/Application Support/Lloyd/models exists with user write permissions
APP_SUPPORT_MODELS="${HOME}/Library/Application Support/Lloyd/models"
mkdir -p "${APP_SUPPORT_MODELS}"
chmod 755 "${HOME}/Library/Application Support/Lloyd" "${APP_SUPPORT_MODELS}"

# 3. Write Info.plist with microphone & Application Support access
cat > "${APP_BUNDLE}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Lloyd</string>
  <key>CFBundleDisplayName</key>
  <string>Lloyd AI Companion</string>
  <key>CFBundleIdentifier</key>
  <string>com.eneskayaci.lloyd</string>
  <key>CFBundleVersion</key>
  <string>2.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0.0</string>
  <key>CFBundleExecutable</key>
  <string>Lloyd</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright © 2026 Mustafa Enes Kayaci (Enes). MIT License.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Lloyd uses your microphone for 100% local, offline voice conversation.</string>
</dict>
</plist>
EOF

# 4. Compile native Apple Silicon Objective-C Cocoa + WKWebView Desktop App binary
echo "[3/5] Compiling native arm64 Cocoa + WKWebView desktop wrapper..."
NATIVE_SRC="${DIST_DIR}/lloyd_native.m"
cat > "${NATIVE_SRC}" <<'EOF'
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#include <sys/stat.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *backendTask;
@property (strong, nonatomic) NSTimer *pollTimer;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    // 1. Ensure ~/Library/Application Support/Lloyd/models directory exists with 0755 permissions
    NSString *appSupport = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/Lloyd/models"];
    [[NSFileManager defaultManager] createDirectoryAtPath:appSupport
                              withIntermediateDirectories:YES
                                               attributes:@{NSFilePosixPermissions: @(0755)}
                                                    error:nil];

    // 2. Locate bundled backend/app.py or workspace backend/app.py
    NSString *bundleResources = [[NSBundle mainBundle] resourcePath];
    NSString *bundledBackend = [bundleResources stringByAppendingPathComponent:@"backend/app.py"];
    NSString *workspaceBackend = @"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/backend/app.py";
    NSString *backendScript = [[NSFileManager defaultManager] fileExistsAtPath:bundledBackend]
        ? bundledBackend
        : workspaceBackend;

    NSString *venvPython = @"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/.venv/bin/python";
    NSString *brewPython = @"/opt/homebrew/bin/python3.12";
    NSString *pythonExec = [[NSFileManager defaultManager] isExecutableFileAtPath:venvPython]
        ? venvPython
        : ([[NSFileManager defaultManager] isExecutableFileAtPath:brewPython] ? brewPython : @"/usr/bin/python3");

    self.backendTask = [[NSTask alloc] init];
    self.backendTask.executableURL = [NSURL fileURLWithPath:pythonExec];
    self.backendTask.arguments = @[backendScript];
    self.backendTask.currentDirectoryURL = [NSURL fileURLWithPath:[backendScript stringByDeletingLastPathComponent]];

    NSMutableDictionary *env = [[[NSProcessInfo processInfo] environment] mutableCopy];
    env[@"PATH"] = @"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
    env[@"LLOYD_APP_SUPPORT_DIR"] = appSupport;
    self.backendTask.environment = env;

    NSError *err = nil;
    [self.backendTask launchAndReturnError:&err];

    // 3. Create sleek frameless-titlebar macOS window
    NSRect frame = NSMakeRect(0, 0, 1320, 840);
    NSUInteger style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                       NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable |
                       NSWindowStyleMaskFullSizeContentView;

    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"LLOYD // Neural 3D Companion (Engineered by Enes)"];
    self.window.titlebarAppearsTransparent = YES;
    self.window.backgroundColor = [NSColor colorWithSRGBRed:0.02 green:0.03 blue:0.078 alpha:1.0];
    [self.window center];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;

    self.webView = [[WKWebView alloc] initWithFrame:frame configuration:config];
    self.webView.UIDelegate = self;
    self.webView.navigationDelegate = self;
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [self.webView setValue:@(NO) forKey:@"drawsBackground"];

    [self.window setContentView:self.webView];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:0.5
                                                      target:self
                                                    selector:@selector(checkServerAndLoad)
                                                    userInfo:nil
                                                     repeats:YES];
}

- (void)checkServerAndLoad {
    NSURL *healthURL = [NSURL URLWithString:@"http://127.0.0.1:8000/api/health"];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:healthURL
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          NSHTTPURLResponse *httpResp = (NSHTTPURLResponse *)response;
          if (!error && httpResp.statusCode == 200) {
              dispatch_async(dispatch_get_main_queue(), ^{
                  [self.pollTimer invalidate];
                  self.pollTimer = nil;
                  NSURL *appURL = [NSURL URLWithString:@"http://127.0.0.1:8000/"];
                  [self.webView loadRequest:[NSURLRequest requestWithURL:appURL]];
              });
          }
      }];
    [task resume];
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    if (self.backendTask && self.backendTask.isRunning) {
        [self.backendTask terminate];
    }
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app run];
    }
    return 0;
}
EOF

clang -O2 -arch arm64 -fobjc-arc \
  -framework Cocoa -framework WebKit \
  "${NATIVE_SRC}" -o "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
rm -f "${NATIVE_SRC}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

# 5. Prepare Drag-and-Drop DMG Staging Directory (Lloyd.app -> /Applications)
echo "[4/5] Configuring DMG drag-and-drop staging folder (Lloyd.app -> /Applications)..."
mkdir -p "${STAGING_DIR}/.background"
cp -R "${APP_BUNDLE}" "${STAGING_DIR}/${APP_NAME}.app"
ln -s /Applications "${STAGING_DIR}/Applications"

# Create a clean README inside the DMG explaining first-launch onboarding
cat > "${STAGING_DIR}/INSTALL_GUIDE.txt" <<EOF
===================================================================
  LLOYD V2 — AUTONOMOUS 3D APPLE SILICON COMPANION
  Author    : Mustafa Enes Kayaci (Enes)
  Repository: https://github.com/MustafaEnes123/Lloyd
  License   : MIT License
===================================================================
1. Drag "Lloyd.app" into the "Applications" folder shortcut.
2. Launch Lloyd from Applications.
3. On first launch, Lloyd's Neural Onboarding Wizard will verify or
   download the required local models directly into:
   ~/Library/Application Support/Lloyd/models
===================================================================
EOF

# 6. Create lightweight compressed .dmg installer image
echo "[5/5] Building portable zero-bundle Disk Image (${DMG_PATH})..."
rm -f "${DMG_PATH}"
hdiutil create -volname "Lloyd Installer" \
  -srcfolder "${STAGING_DIR}" \
  -ov -format UDZO "${DMG_PATH}" >/dev/null
rm -rf "${STAGING_DIR}"

DMG_SIZE_KB=$(du -k "${DMG_PATH}" | cut -f1)
echo "=================================================================="
echo "  V2 BUILD COMPLETE!"
echo "  Native macOS App : ${APP_BUNDLE}"
echo "  Portable DMG     : ${DMG_PATH} (${DMG_SIZE_KB} KB — zero heavy models bundled)"
echo "  Model Vault Path : ${APP_SUPPORT_MODELS}"
echo "=================================================================="
