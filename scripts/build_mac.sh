#!/usr/bin/env bash
# ============================================================================
# PROJECT LLOYD — AUTOMATED NATIVE macOS .APP & .DMG PACKAGER
# Compiles a native Apple Silicon Cocoa/WKWebView desktop wrapper + bundles
# the frontend build and local Python Metal inference daemon into Lloyd.app.
# ============================================================================
set -euo pipefail

PROJECT_ROOT="/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
DIST_DIR="${PROJECT_ROOT}/dist"
APP_NAME="Lloyd"
APP_BUNDLE="${DIST_DIR}/${APP_NAME}.app"
DMG_PATH="${DIST_DIR}/${APP_NAME}-macOS-arm64.dmg"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

echo "=================================================================="
echo "  PACKAGING PROJECT LLOYD -> NATIVE macOS .APP & .DMG"
echo "=================================================================="

# 1. Build production Vite + React + Three.js frontend
echo "[1/4] Building production 3D frontend assets..."
cd "${FRONTEND_DIR}"
npm run build

# 2. Construct macOS .app bundle hierarchy
echo "[2/4] Assembling ${APP_BUNDLE} bundle structure..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# 3. Write Info.plist with microphone permission & high-DPI Retina flags
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
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>Lloyd</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSMicrophoneUsageDescription</key>
  <string>Lloyd uses your microphone for local, real-time offline voice conversation.</string>
</dict>
</plist>
EOF

# 4. Compile native Apple Silicon Objective-C Cocoa + WKWebView Desktop App binary
echo "[3/4] Compiling native arm64 Cocoa + WKWebView desktop binary..."
NATIVE_SRC="${DIST_DIR}/lloyd_native.m"
cat > "${NATIVE_SRC}" <<'EOF'
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#include <signal.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *backendTask;
@property (strong, nonatomic) NSTimer *pollTimer;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    // 1. Launch the local FastAPI Metal daemon in background
    self.backendTask = [[NSTask alloc] init];
    self.backendTask.executableURL = [NSURL fileURLWithPath:@"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/.venv/bin/python"];
    self.backendTask.arguments = @[@"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/backend/app.py"];
    self.backendTask.currentDirectoryURL = [NSURL fileURLWithPath:@"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/backend"];
    
    NSMutableDictionary *env = [[[NSProcessInfo processInfo] environment] mutableCopy];
    env[@"PATH"] = @"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
    self.backendTask.environment = env;
    
    NSError *err = nil;
    [self.backendTask launchAndReturnError:&err];

    // 2. Create sleek frameless-titlebar macOS window
    NSRect frame = NSMakeRect(0, 0, 1280, 820);
    NSUInteger style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                       NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable |
                       NSWindowStyleMaskFullSizeContentView;

    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"LLOYD // Autonomous 3D Companion (Engineered by Enes)"];
    self.window.titlebarAppearsTransparent = YES;
    self.window.backgroundColor = [NSColor colorWithSRGBRed:0.024 green:0.031 blue:0.067 alpha:1.0];
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

    // Poll local server readiness then load UI
    self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:0.6
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

# 5. Create standalone .dmg installer image
echo "[4/4] Creating standalone macOS Disk Image (${DMG_PATH})..."
rm -f "${DMG_PATH}"
hdiutil create -volname "Lloyd AI Companion" \
  -srcfolder "${APP_BUNDLE}" \
  -ov -format UDZO "${DMG_PATH}" >/dev/null

echo "=================================================================="
echo "  BUILD COMPLETE!"
echo "  Native macOS App : ${APP_BUNDLE}"
echo "  Standalone DMG   : ${DMG_PATH}"
echo "=================================================================="
