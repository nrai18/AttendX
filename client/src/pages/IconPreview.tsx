import React from "react";

// Mock DeviceAvatar based on the exact same logic in linked-devices.tsx
function DeviceAvatar({ os, browser }: { os: string; browser: string }) {
  const osLower = os.toLowerCase();
  const browserLower = browser.toLowerCase();
  
  let osLogo = "windows.svg";
  if (osLower.includes("mac")) osLogo = "macos.svg";
  else if (osLower.includes("ios") || osLower.includes("iphone") || osLower.includes("ipad")) osLogo = "ios.svg";
  else if (osLower.includes("android")) osLogo = "android.svg";
  else if (osLower.includes("ubuntu")) osLogo = "ubuntu.svg";
  else if (osLower.includes("linux")) osLogo = "linux.svg";

  // Resolve Browser Badge
  let browserBadge = null;
  if (browserLower.includes("chrome")) browserBadge = "chrome.svg";
  else if (browserLower.includes("edge")) browserBadge = "edge.svg";
  else if (browserLower.includes("brave")) browserBadge = "brave.svg";
  else if (browserLower.includes("firefox")) browserBadge = "firefox.svg";
  else if (browserLower.includes("safari")) browserBadge = "safari.svg";
  else if (browserLower.includes("opera") && !browserLower.includes("mini")) browserBadge = "opera.svg";
  else if (browserLower.includes("opera mini")) browserBadge = "opera_mini.svg";
  else if (browserLower.includes("vivaldi")) browserBadge = "vivaldi.svg";
  else if (browserLower.includes("duckduckgo")) browserBadge = "duckduckgo.svg";
  else if (browserLower.includes("samsung")) browserBadge = "samsung-browser.svg";
  else if (browserLower.includes("midori")) browserBadge = "midori.svg";
  else if (browserLower.includes("comet")) browserBadge = "696ec0dc4c5ef-Comet-Browser.svg";
  else if (browserLower.includes("zen")) browserBadge = "zen-browser.svg";
  else if (browserLower.includes("arc")) browserBadge = "arc.svg";

  return (
    <div className="flex flex-col items-center gap-3 w-28">
      <div className="relative w-[60px] h-[60px] shrink-0">
        <img src={`/icons/os/${osLogo}`} className="w-full h-full object-contain drop-shadow-sm" alt={os} />
        
        {browserBadge && (
          <div className="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full bg-white shadow-sm flex items-center justify-center p-[2px] border border-gray-100">
            <img src={`/icons/browsers/${browserBadge}`} className="w-full h-full object-contain" alt={browser} />
          </div>
        )}
      </div>
      <p className="text-xs text-center text-muted-foreground font-medium">{os} + {browser}</p>
    </div>
  );
}

const OS_LIST = ["Windows", "macOS", "Android", "iOS", "Ubuntu", "Linux"];
const BROWSER_LIST = [
  "Chrome", "Edge", "Brave", "Firefox", "Safari", "Arc", 
  "Opera", "Vivaldi", "DuckDuckGo", "Samsung Internet", "Comet", "Zen"
];

export default function IconPreview() {
  return (
    <div className="min-h-screen bg-white text-black p-12">
      <h1 className="text-3xl font-bold text-center mb-12">AttendX Icon Generation Preview</h1>
      
      <div className="space-y-16 max-w-6xl mx-auto">
        {OS_LIST.map(os => (
          <div key={os} className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-8 text-blue-600">{os} + Browsers</h2>
            <div className="flex flex-wrap justify-center gap-8">
              {BROWSER_LIST.map(browser => (
                <DeviceAvatar key={browser} os={os} browser={browser} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
