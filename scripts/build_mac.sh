#!/usr/bin/env bash
# ============================================================================
# PROJECT LLOYD — PORTABLE ZERO-CONFIG macOS .APP & DRAG-AND-DROP .DMG
# Packages Lloyd into a lightweight .dmg installer (<5 MB, zero 1GB+ models
# bundled inside the binary), with custom macOS AppIcon.icns, /Applications
# drag-and-drop symlink, and ~/Library/Application Support/Lloyd/models vault.
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
echo "  PACKAGING PROJECT LLOYD -> PORTABLE macOS .APP & .DMG"
echo "=================================================================="

# 1. Build production Vite + React + Three.js frontend
echo "[1/6] Building production 3D Orbital Studio frontend..."
cd "${FRONTEND_DIR}"
npm run build

# 2. Construct macOS .app bundle hierarchy (without 1.1GB model binaries)
echo "[2/6] Assembling lightweight ${APP_BUNDLE} bundle..."
rm -rf "${APP_BUNDLE}" "${STAGING_DIR}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources/backend"
mkdir -p "${APP_BUNDLE}/Contents/Resources/frontend/dist"

# Copy backend Python daemon sources & frontend build into Resources
cp "${BACKEND_DIR}"/*.py "${BACKEND_DIR}/requirements.txt" "${APP_BUNDLE}/Contents/Resources/backend/"
cp -R "${FRONTEND_DIR}/dist/"* "${APP_BUNDLE}/Contents/Resources/frontend/dist/"
cp "${PROJECT_ROOT}/LICENSE" "${APP_BUNDLE}/Contents/Resources/"

# 3. Generate High-Resolution Native macOS AppIcon.icns (CoreGraphics 1024x1024 -> iconutil)
echo "[3/6] Generating high-resolution macOS AppIcon.icns..."
ICONSET_DIR="${DIST_DIR}/AppIcon.iconset"
rm -rf "${ICONSET_DIR}"
mkdir -p "${ICONSET_DIR}"

ICON_GEN_SRC="${DIST_DIR}/generate_icon.m"
cat > "${ICON_GEN_SRC}" <<'EOF'
#import <Cocoa/Cocoa.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) return 1;
        NSString *outPath = [NSString stringWithUTF8String:argv[1]];
        int size = 1024;

        NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL
                          pixelsWide:size
                          pixelsHigh:size
                       bitsPerSample:8
                     samplesPerPixel:4
                            hasAlpha:YES
                            isPlanar:NO
                      colorSpaceName:NSCalibratedRGBColorSpace
                         bytesPerRow:0
                        bitsPerPixel:0];

        NSGraphicsContext *ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
        [NSGraphicsContext saveGraphicsState];
        [NSGraphicsContext setCurrentContext:ctx];

        // 1. Apple macOS Squircle Outer Body (Inset 88px per Apple HIG 1024pt grid)
        NSRect bgRect = NSMakeRect(88, 88, 848, 848);
        NSBezierPath *squircle = [NSBezierPath bezierPathWithRoundedRect:bgRect xRadius:196 yRadius:196];

        NSGradient *bgGrad = [[NSGradient alloc] initWithColorsAndLocations:
            [NSColor colorWithSRGBRed:0.09 green:0.13 blue:0.24 alpha:1.0], 0.0,
            [NSColor colorWithSRGBRed:0.04 green:0.06 blue:0.12 alpha:1.0], 0.55,
            [NSColor colorWithSRGBRed:0.02 green:0.03 blue:0.06 alpha:1.0], 1.0, nil];
        [bgGrad drawInBezierPath:squircle angle:-65];

        // Subtle inner cosmic radial glow
        NSGradient *coreGlow = [[NSGradient alloc] initWithStartingColor:[NSColor colorWithSRGBRed:0.18 green:0.58 blue:0.98 alpha:0.28]
                                                             endingColor:[NSColor colorWithSRGBRed:0.02 green:0.03 blue:0.06 alpha:0.0]];
        [coreGlow drawInBezierPath:squircle relativeCenterPosition:NSMakePoint(0, 0.1)];

        // Squircle Specular Border
        [[NSColor colorWithSRGBRed:0.55 green:0.82 blue:1.0 alpha:0.35] setStroke];
        [squircle setLineWidth:8.0];
        [squircle stroke];

        // 2. Tilted Orbital Ring around Robot Head
        NSGraphicsContext *current = [NSGraphicsContext currentContext];
        [current saveGraphicsState];
        NSAffineTransform *transform = [NSAffineTransform transform];
        [transform translateXBy:512 yBy:500];
        [transform rotateByDegrees:-20];
        [transform concat];

        NSBezierPath *orbitRing = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(-340, -105, 680, 210)];
        [[NSColor colorWithSRGBRed:0.22 green:0.74 blue:0.97 alpha:0.55] setStroke];
        [orbitRing setLineWidth:12.0];
        [orbitRing stroke];
        [current restoreGraphicsState];

        // 3. Sculpted Aerospace Titanium Robot Head Capsule
        NSRect headRect = NSMakeRect(242, 272, 540, 460);
        NSBezierPath *headPath = [NSBezierPath bezierPathWithRoundedRect:headRect xRadius:210 yRadius:210];
        NSGradient *headGrad = [[NSGradient alloc] initWithColorsAndLocations:
            [NSColor colorWithSRGBRed:0.98 green:0.99 blue:1.0 alpha:1.0], 0.0,
            [NSColor colorWithSRGBRed:0.84 green:0.90 blue:0.96 alpha:1.0], 0.7,
            [NSColor colorWithSRGBRed:0.65 green:0.76 blue:0.88 alpha:1.0], 1.0, nil];
        [headGrad drawInBezierPath:headPath angle:-90];

        [[NSColor colorWithSRGBRed:1.0 green:1.0 blue:1.0 alpha:0.8] setStroke];
        [headPath setLineWidth:6.0];
        [headPath stroke];

        // Left & Right Ear Telemetry Pods
        NSBezierPath *leftEar = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(200, 440, 46, 130) xRadius:22 yRadius:22];
        NSBezierPath *rightEar = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(778, 440, 46, 130) xRadius:22 yRadius:22];
        [[NSColor colorWithSRGBRed:0.22 green:0.74 blue:0.97 alpha:1.0] setFill];
        [leftEar fill];
        [rightEar fill];

        // 4. Curved Obsidian OLED Visor Faceplate
        NSRect visorRect = NSMakeRect(292, 336, 440, 316);
        NSBezierPath *visorPath = [NSBezierPath bezierPathWithRoundedRect:visorRect xRadius:142 yRadius:142];
        NSGradient *visorGrad = [[NSGradient alloc] initWithStartingColor:[NSColor colorWithSRGBRed:0.05 green:0.09 blue:0.20 alpha:1.0]
                                                              endingColor:[NSColor colorWithSRGBRed:0.02 green:0.03 blue:0.08 alpha:1.0]];
        [visorGrad drawInBezierPath:visorPath angle:-90];

        [[NSColor colorWithSRGBRed:0.22 green:0.74 blue:0.97 alpha:0.45] setStroke];
        [visorPath setLineWidth:5.0];
        [visorPath stroke];

        // 5. Glowing Cyan/White Expressive Robot Eyes
        NSRect leftEyeRect = NSMakeRect(366, 470, 92, 114);
        NSRect rightEyeRect = NSMakeRect(566, 470, 92, 114);
        NSBezierPath *leftEye = [NSBezierPath bezierPathWithRoundedRect:leftEyeRect xRadius:44 yRadius:44];
        NSBezierPath *rightEye = [NSBezierPath bezierPathWithRoundedRect:rightEyeRect xRadius:44 yRadius:44];

        [[NSColor colorWithSRGBRed:0.22 green:0.74 blue:0.97 alpha:1.0] setFill];
        [leftEye fill];
        [rightEye fill];

        NSBezierPath *leftCore = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(leftEyeRect, 12, 12) xRadius:34 yRadius:34];
        NSBezierPath *rightCore = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(rightEyeRect, 12, 12) xRadius:34 yRadius:34];
        [[NSColor whiteColor] setFill];
        [leftCore fill];
        [rightCore fill];

        // 6. Warm Smiling Mouth Arc on OLED Visor
        NSBezierPath *smile = [NSBezierPath bezierPath];
        [smile moveToPoint:NSMakePoint(442, 412)];
        [smile curveToPoint:NSMakePoint(582, 412)
              controlPoint1:NSMakePoint(476, 366)
              controlPoint2:NSMakePoint(548, 366)];
        [smile setLineCapStyle:NSLineCapStyleRound];
        [[NSColor colorWithSRGBRed:0.22 green:0.74 blue:0.97 alpha:1.0] setStroke];
        [smile setLineWidth:24.0];
        [smile stroke];

        [[NSColor whiteColor] setStroke];
        [smile setLineWidth:12.0];
        [smile stroke];

        [NSGraphicsContext restoreGraphicsState];

        NSData *pngData = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        [pngData writeToFile:outPath atomically:YES];
    }
    return 0;
}
EOF

MASTER_ICON_PNG="${DIST_DIR}/icon_1024.png"
clang -O2 -arch arm64 -fobjc-arc -framework Cocoa "${ICON_GEN_SRC}" -o "${DIST_DIR}/generate_icon"
"${DIST_DIR}/generate_icon" "${MASTER_ICON_PNG}"
rm -f "${ICON_GEN_SRC}" "${DIST_DIR}/generate_icon"

sips -z 16 16     "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_16x16.png" >/dev/null
sips -z 32 32     "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_32x32.png" >/dev/null
sips -z 64 64     "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_128x128.png" >/dev/null
sips -z 256 256   "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_256x256.png" >/dev/null
sips -z 512 512   "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "${MASTER_ICON_PNG}" --out "${ICONSET_DIR}/icon_512x512.png" >/dev/null
cp "${MASTER_ICON_PNG}" "${ICONSET_DIR}/icon_512x512@2x.png"

iconutil -c icns "${ICONSET_DIR}" -o "${APP_BUNDLE}/Contents/Resources/AppIcon.icns"
rm -rf "${ICONSET_DIR}" "${MASTER_ICON_PNG}"

# Target model vault path created on first launch by Lloyd.app
APP_SUPPORT_MODELS="${HOME}/Library/Application Support/Lloyd/models"

# 4. Write Info.plist with custom AppIcon, microphone & Application Support access
cat > "${APP_BUNDLE}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Lloyd</string>
  <key>CFBundleDisplayName</key>
  <string>Lloyd</string>
  <key>CFBundleIdentifier</key>
  <string>com.eneskayaci.lloyd</string>
  <key>CFBundleVersion</key>
  <string>2.5.0</string>
  <key>CFBundleShortVersionString</key>
  <string>2.5.0</string>
  <key>CFBundleExecutable</key>
  <string>Lloyd</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIconName</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright © 2026. MIT License.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Lloyd uses your microphone for 100% local, offline voice conversation.</string>
</dict>
</plist>
EOF

# 5. Compile native Apple Silicon Objective-C Cocoa + WKWebView Desktop App binary
echo "[4/6] Compiling native arm64 Cocoa + WKWebView desktop wrapper..."
NATIVE_SRC="${DIST_DIR}/lloyd_native.m"
cat > "${NATIVE_SRC}" <<'EOF'
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#include <sys/stat.h>
#include <stdlib.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *backendTask;
@property (strong, nonatomic) NSTimer *pollTimer;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    // Set Dock and Application Icon from bundled AppIcon.icns
    NSString *iconPath = [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"AppIcon.icns"];
    if ([[NSFileManager defaultManager] fileExistsAtPath:iconPath]) {
        NSImage *iconImage = [[NSImage alloc] initWithContentsOfFile:iconPath];
        if (iconImage) {
            [NSApp setApplicationIconImage:iconImage];
        }
    }

    // 1. Ensure ~/Library/Application Support/Lloyd/models directory exists with 0755 permissions
    NSString *lloydSupportRoot = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/Lloyd"];
    NSString *appSupport = [lloydSupportRoot stringByAppendingPathComponent:@"models"];
    [[NSFileManager defaultManager] createDirectoryAtPath:appSupport
                              withIntermediateDirectories:YES
                                               attributes:@{NSFilePosixPermissions: @(0755)}
                                                    error:nil];

    // 2. Cleanly terminate any stale daemon holding port 8000 so the fresh bundle always serves
    system("/usr/sbin/lsof -ti:8000 | /usr/bin/xargs kill -9 >/dev/null 2>&1 || true");

    // 3. Locate bundled backend/app.py
    NSString *bundleResources = [[NSBundle mainBundle] resourcePath];
    NSString *bundledBackend = [bundleResources stringByAppendingPathComponent:@"backend/app.py"];
    NSString *bundledReqs = [bundleResources stringByAppendingPathComponent:@"backend/requirements.txt"];

    // 4. Launch backend in background (auto-bootstrapping ~/Library/Application Support/Lloyd/venv on any new Mac)
    NSString *supportVenvPython = [lloydSupportRoot stringByAppendingPathComponent:@"venv/bin/python"];
    NSString *devVenvPython = @"/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/.venv/bin/python";

    NSString *launchCmd = [NSString stringWithFormat:
        @"export PATH=\"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin\"; "
        @"export PYTHONDONTWRITEBYTECODE=1; "
        @"export LLOYD_APP_SUPPORT_DIR=\"%@\"; "
        @"if [ -x \"%@\" ]; then "
        @"  exec \"%@\" -B \"%@\"; "
        @"elif [ -x \"%@\" ]; then "
        @"  exec \"%@\" -B \"%@\"; "
        @"else "
        @"  SYS_PY=$(command -v python3.12 || command -v python3.11 || command -v python3); "
        @"  \"$SYS_PY\" -m venv \"%@/venv\" && "
        @"  \"%@/venv/bin/pip\" install --upgrade pip && "
        @"  \"%@/venv/bin/pip\" install -r \"%@\" && "
        @"  exec \"%@/venv/bin/python\" -B \"%@\"; "
        @"fi",
        appSupport,
        devVenvPython, devVenvPython, bundledBackend,
        supportVenvPython, supportVenvPython, bundledBackend,
        lloydSupportRoot, lloydSupportRoot, lloydSupportRoot, bundledReqs, lloydSupportRoot, bundledBackend
    ];

    self.backendTask = [[NSTask alloc] init];
    self.backendTask.executableURL = [NSURL fileURLWithPath:@"/bin/zsh"];
    self.backendTask.arguments = @[@"-c", launchCmd];
    self.backendTask.currentDirectoryURL = [NSURL fileURLWithPath:lloydSupportRoot];

    NSError *err = nil;
    [self.backendTask launchAndReturnError:&err];

    // 4. Create sleek frameless-titlebar macOS window
    NSRect frame = NSMakeRect(0, 0, 1340, 860);
    NSUInteger style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                       NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable |
                       NSWindowStyleMaskFullSizeContentView;

    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"Lloyd"];
    self.window.titlebarAppearsTransparent = YES;
    self.window.titleVisibility = NSWindowTitleHidden;
    self.window.backgroundColor = [NSColor colorWithSRGBRed:0.016 green:0.027 blue:0.067 alpha:1.0];
    [self.window center];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;

    // Clear stale WebKit disk/memory caches so latest 3D shaders and assets always load
    NSSet *dataTypes = [NSSet setWithArray:@[
        WKWebsiteDataTypeDiskCache,
        WKWebsiteDataTypeMemoryCache
    ]];
    [[WKWebsiteDataStore defaultDataStore] removeDataOfTypes:dataTypes
                                               modifiedSince:[NSDate distantPast]
                                           completionHandler:^{}];

    self.webView = [[WKWebView alloc] initWithFrame:frame configuration:config];
    self.webView.UIDelegate = self;
    self.webView.navigationDelegate = self;
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

    // Render immediate cosmic launch splash while local Metal engines boot (1-2s)
    NSString *splashHTML = @"<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
        "body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;"
        "background:radial-gradient(circle at 50% 45%,#0c1938 0%,#040711 70%);color:#f8fafc;"
        "font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;user-select:none;}"
        ".orb{width:56px;height:56px;border-radius:18px;background:linear-gradient(145deg,#1e293b,#090d16);"
        "border:1px solid rgba(56,189,248,0.4);box-shadow:0 0 32px rgba(56,189,248,0.25);"
        "display:flex;align-items:center;justify-content:center;margin-bottom:16px;animation:p 1.8s infinite ease-in-out;}"
        ".dot{width:14px;height:14px;border-radius:50%;background:#38bdf8;box-shadow:0 0 16px #38bdf8;}"
        ".title{font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:6px;}"
        ".sub{font-size:12px;color:#94a3b8;}"
        "@keyframes p{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}"
        "</style></head><body><div class='orb'><div class='dot'></div></div>"
        "<div class='title'>Initializing Lloyd Orbital Studio</div>"
        "<div class='sub'>Mounting local Apple Silicon Metal engines…</div></body></html>";
    [self.webView loadHTMLString:splashHTML baseURL:nil];

    [self.window setContentView:self.webView];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:0.35
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
                  NSURLRequest *req = [NSURLRequest requestWithURL:appURL
                                                       cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                                   timeoutInterval:15.0];
                  [self.webView loadRequest:req];
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

# Strip extended attributes & .DS_Store, then seal the entire .app bundle with codesign
# (Prevents macOS Gatekeeper "is damaged and can't be opened" / errSecCSResourcesNotFound)
find "${APP_BUNDLE}" -name ".DS_Store" -delete
find "${APP_BUNDLE}" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
xattr -cr "${APP_BUNDLE}"
codesign --force --deep --sign - "${APP_BUNDLE}"
codesign --verify --deep --strict --verbose=2 "${APP_BUNDLE}"

# 6. Prepare Drag-and-Drop DMG Staging Directory (Lloyd.app -> /Applications)
echo "[5/6] Configuring DMG drag-and-drop staging folder (Lloyd.app -> /Applications)..."
mkdir -p "${STAGING_DIR}"
cp -R "${APP_BUNDLE}" "${STAGING_DIR}/${APP_NAME}.app"
ln -s /Applications "${STAGING_DIR}/Applications"
xattr -cr "${STAGING_DIR}/${APP_NAME}.app"

cat > "${STAGING_DIR}/INSTALL_GUIDE.txt" <<EOF
===================================================================
  LLOYD — AUTONOMOUS 3D APPLE SILICON COMPANION
  License   : MIT License
===================================================================
1. Drag "Lloyd.app" into the "Applications" folder shortcut.
2. Launch Lloyd from Applications.
3. On first launch, Lloyd's Onboarding Wizard will verify or
   download the required local models directly into:
   ~/Library/Application Support/Lloyd/models
===================================================================
EOF

# 7. Create lightweight compressed .dmg installer image (both app.dmg and Lloyd-macOS-arm64.dmg)
echo "[6/6] Building portable zero-bundle Disk Image (${DMG_PATH} & ${DIST_DIR}/app.dmg)..."
rm -f "${DMG_PATH}" "${DIST_DIR}/app.dmg"
hdiutil create -volname "Lloyd Installer" \
  -srcfolder "${STAGING_DIR}" \
  -ov -format UDZO "${DMG_PATH}" >/dev/null
codesign --force --sign - "${DMG_PATH}"
cp "${DMG_PATH}" "${DIST_DIR}/app.dmg"
rm -rf "${STAGING_DIR}"

DMG_SIZE_KB=$(du -k "${DIST_DIR}/app.dmg" | cut -f1)
echo "=================================================================="
echo "  BUILD COMPLETE!"
echo "  Native macOS App : ${APP_BUNDLE}"
echo "  Custom App Icon  : ${APP_BUNDLE}/Contents/Resources/AppIcon.icns"
echo "  Portable DMG     : ${DIST_DIR}/app.dmg (${DMG_SIZE_KB} KB)"
echo "  Release DMG      : ${DMG_PATH} (${DMG_SIZE_KB} KB)"
echo "  Model Vault Path : ${APP_SUPPORT_MODELS}"
echo "=================================================================="
