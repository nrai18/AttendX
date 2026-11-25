import { getMarketingName } from './deviceMapper';
import { UAParser } from 'ua-parser-js';

const gpsLocationCache = new Map<string, { location: string; expiresAt: number }>();
const ipLocationCache = new Map<string, { location: string; expiresAt: number }>();
const GEO_CACHE_TTL_MS = 15 * 60 * 1000;

export function getFastDeviceDetails(req: any) {
  if (!req) return { userAgent: 'Unknown OS', ipAddress: null, location: 'Unknown Location', os: null, browser: null, deviceType: null };
  const headers = req.headers || {};
  const uaString = headers['user-agent'] || '';
  const platformHeader = headers['x-attendx-platform'];
  const osHeader = headers['x-attendx-os'];

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  let userAgent = 'Unknown OS';
  if (platformHeader && osHeader && osHeader !== 'web') {
    userAgent = `${platformHeader} (${osHeader})`;
  } else if (uaString.includes('Capacitor') || uaString.includes('AttendX')) {
    if (uaString.includes('Android')) userAgent = 'AttendX App (Android)';
    else if (uaString.includes('iPhone') || uaString.includes('iPad')) userAgent = 'AttendX App (iOS)';
    else userAgent = 'AttendX App';
  } else if (result.browser.name) {
    userAgent = result.browser.name + (result.os.name ? ' on ' + result.os.name : '');
  } else if (result.os.name) {
    userAgent = result.os.name;
  }

  const forwarded = headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || null;
  const timezone = headers['x-attendx-timezone'];

  let location = 'Unknown Location';
  const lat = headers['x-attendx-lat'];
  const lon = headers['x-attendx-lon'];
  if (lat && lon) {
    const coordKey = `${parseFloat(String(lat)).toFixed(2)},${parseFloat(String(lon)).toFixed(2)}`;
    const cachedGps = gpsLocationCache.get(coordKey);
    if (cachedGps && cachedGps.expiresAt > Date.now()) {
      location = cachedGps.location;
    }
  }
  if (location === 'Unknown Location' && ipAddress) {
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.16.')) {
      location = 'Local Network';
    } else {
      const cachedIp = ipLocationCache.get(ipAddress);
      if (cachedIp && cachedIp.expiresAt > Date.now()) {
        location = cachedIp.location;
      }
    }
  }
  if ((location === 'Unknown Location' || location === 'Local Network') && typeof timezone === 'string') {
    location = timezone.split('/').reverse().join(', ').replace(/_/g, ' ');
  }

  let os: string | null = null;
  let browser: string | null = null;
  let deviceType: string | null = null;

  const customBrowser = headers['x-attendx-browser'];
  const hardwareModel = headers['x-attendx-hardware'];
  const appVersion = headers['x-attendx-version'];
  const realOsHeader = typeof headers['x-attendx-real-os'] === 'string' ? headers['x-attendx-real-os'].trim() : '';

  const isIosUa = /iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS|OPiOS/i.test(uaString);
  const iosBrowserFromUa = /CriOS/i.test(uaString)
    ? 'Chrome'
    : /FxiOS/i.test(uaString)
      ? 'Firefox'
      : /EdgiOS/i.test(uaString)
        ? 'Microsoft Edge'
        : /OPiOS/i.test(uaString)
          ? 'Opera'
          : null;

  if (platformHeader && osHeader && osHeader !== 'web') {
    deviceType = String(platformHeader).toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
    os = String(osHeader).toLowerCase() === 'ios' ? 'iOS' : String(osHeader).charAt(0).toUpperCase() + String(osHeader).slice(1);
    const versionStr = appVersion ? ` ${appVersion}` : '';

    let finalDeviceString = (hardwareModel && hardwareModel !== 'Native Device') ? String(hardwareModel) : null;
    if (hardwareModel && String(hardwareModel).includes('::')) {
      try {
        const [manufacturer, rawModel] = String(hardwareModel).split('::');
        finalDeviceString = getMarketingName(rawModel, manufacturer);
      } catch {}
    }
    if (!finalDeviceString || finalDeviceString === 'Native Device') {
      if (result.device.vendor && result.device.model) {
        finalDeviceString = `${result.device.vendor} ${result.device.model}`;
      } else if (result.device.model) {
        finalDeviceString = result.device.model;
      }
    }
    browser = finalDeviceString ? `AttendX${versionStr} (${finalDeviceString})` : `AttendX Native App${versionStr}`;
  } else if (isIosUa || realOsHeader === 'iOS') {
    deviceType = /iPad/i.test(uaString) ? 'tablet' : 'mobile';
    os = 'iOS';
    browser = iosBrowserFromUa || (customBrowser ? String(customBrowser) : (result.browser.name ? result.browser.name.replace(/^Mobile\s+/i, '') : 'Safari'));
    userAgent = `${browser} on iOS`;
  } else {
    const validDesktopRealOs = realOsHeader === 'Windows' || realOsHeader === 'macOS' || realOsHeader === 'Linux';
    deviceType = validDesktopRealOs ? 'desktop' : (result.device.type || (uaString.includes('Mobile') ? 'mobile' : 'desktop'));
    os = validDesktopRealOs ? realOsHeader : (result.os.name || 'Unknown OS');
    browser = customBrowser ? String(customBrowser) : (result.browser.name ? result.browser.name.replace(/^Mobile\s+/i, '') : 'Unknown Browser');
    if (validDesktopRealOs && browser) {
      userAgent = `${browser} on ${realOsHeader}`;
    }
  }

  return { userAgent, ipAddress, location, os, browser, deviceType };
}

export async function getDeviceDetails(req: any) {
  if (!req) return { userAgent: 'Unknown OS', ipAddress: null, location: null };
  const uaString = req.headers['user-agent'] || '';
  
  const platformHeader = req.headers['x-attendx-platform'];
  const osHeader = req.headers['x-attendx-os'];

  let userAgent = 'Unknown OS';
  if (platformHeader && osHeader && osHeader !== 'web') {
     userAgent = `${platformHeader} (${osHeader})`;
  } else {
    const parser = new UAParser(uaString);
    const result = parser.getResult();
    if (uaString.includes('Capacitor') || uaString.includes('AttendX')) {
      if (uaString.includes('Android')) userAgent = 'AttendX App (Android)';
      else if (uaString.includes('iPhone') || uaString.includes('iPad')) userAgent = 'AttendX App (iOS)';
      else userAgent = 'AttendX App';
    } else if (result.browser.name) {
      userAgent = result.browser.name + (result.os.name ? ' on ' + result.os.name : '');
    } else if (result.os.name) {
      userAgent = result.os.name;
    }
  }

  let location = 'Unknown Location';
  
  // GPS Geocoding priority!
  const lat = req.headers['x-attendx-lat'];
  const lon = req.headers['x-attendx-lon'];
  
  if (lat && lon) { const coordKey = `${parseFloat(String(lat)).toFixed(2)},${parseFloat(String(lon)).toFixed(2)}`; const cachedGps = gpsLocationCache.get(coordKey); if (cachedGps && cachedGps.expiresAt > Date.now()) { location = cachedGps.location; } else {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, {
        headers: { 'User-Agent': 'AttendXApp/1.0 (admin@attendx.tech)' },
        signal: AbortSignal.timeout(2500)
      });
      const data = await response.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.state_district || data.address.county || data.address.suburb;
        const state = data.address.state;
        if (city && state) location = city.toLowerCase() === state.toLowerCase() ? `New ${city}, ${state}` : `${city}, ${state}`; else if (state) location = state;
        else if (data.display_name) location = data.display_name.split(',').slice(0, 2).join(',');
        if (location !== 'Unknown Location') gpsLocationCache.set(coordKey, { location, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
      }
    } catch (e) {
      console.warn('Nominatim lookup skipped or timed out:', (e as any)?.message || e);
    }
    }
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) || null;

  const timezone = req.headers['x-attendx-timezone'];

  // Priority 1: GPS-based Nominatim (already set above if lat/lon provided)

  // Priority 2: Timezone header (much more reliable than geoip for most requests)
  // Priority 2: IP geolocation (city, state/region) when GPS headers are not attached
  if (location === 'Unknown Location' && ipAddress) {
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.16.')) {
      location = 'Local Network';
    } else {
      const cachedIp = ipLocationCache.get(ipAddress);
      if (cachedIp && cachedIp.expiresAt > Date.now()) {
        location = cachedIp.location;
      } else {
        try {
          const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,regionName,country`, {
            signal: AbortSignal.timeout(1500)
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json() as any;
            if (geoData && (geoData.city || geoData.regionName || geoData.country)) {
              const regionOrCountry = geoData.regionName || geoData.country;
              location = [geoData.city, regionOrCountry].filter(Boolean).join(', ');
              if (location) {
                ipLocationCache.set(ipAddress, { location, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
              }
            }
          }
        } catch {}
      }
    }
  }
  if ((location === 'Unknown Location' || location === 'Local Network') && typeof timezone === 'string') {
    location = timezone.split('/').reverse().join(', ').replace(/_/g, ' ');
  }

  // Priority 3: IP lookup as absolute last resort (only if timezone also absent)
  if (location === 'Unknown Location' && ipAddress) {
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.16.')) {
      location = 'Local Network';
    } else {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,country`, {
          signal: AbortSignal.timeout(1200)
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json() as any;
          if (geoData && (geoData.city || geoData.country)) {
            location = [geoData.city, geoData.country].filter(Boolean).join(', ');
          }
        }
      } catch {
        // Silently preserve Unknown Location without throwing or blocking
      }
    }
  }


  let os = null;
  let browser = null;
  let deviceType = null;
  
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  
  const customBrowser = req.headers['x-attendx-browser'];
  const hardwareModel = req.headers['x-attendx-hardware'];
  const appVersion = req.headers['x-attendx-version'];
  const realOsHeader = typeof req.headers['x-attendx-real-os'] === 'string' ? req.headers['x-attendx-real-os'].trim() : '';

  if (platformHeader && osHeader && osHeader !== 'web') {
     // Native Mobile App
     deviceType = platformHeader.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
     os = osHeader.toLowerCase() === 'ios' ? 'iOS' : osHeader.charAt(0).toUpperCase() + osHeader.slice(1);
     
     // Instead of generic 'AttendX App', use the actual physical phone model (e.g. Galaxy S23) if available
     const versionStr = appVersion ? ` ${appVersion}` : '';
     
     let finalDeviceString = (hardwareModel && hardwareModel !== 'Native Device') ? hardwareModel : null;
     if (hardwareModel && hardwareModel.includes('::')) {
       try {
         const [manufacturer, rawModel] = hardwareModel.split('::');
         finalDeviceString = getMarketingName(rawModel, manufacturer);
       } catch (error) {
         console.error('Device parsing failed:', error);
       }
     }
     
     // Fallback to UA string parser if Capacitor plugin failed (e.g. OTA update without native plugin)
     if (!finalDeviceString || finalDeviceString === 'Native Device') {
        if (result.device.vendor && result.device.model) {
            finalDeviceString = `${result.device.vendor} ${result.device.model}`;
        } else if (result.device.model) {
            finalDeviceString = result.device.model;
        }
     }
     
     browser = finalDeviceString ? `AttendX${versionStr} (${finalDeviceString})` : `AttendX Native App${versionStr}`;
  } else {
    // Guard iOS / iPadOS browsers (CriOS, FxiOS, EdgiOS) from macOS desktop misdetection
    const isIosBrowserUa = /iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS|OPiOS/i.test(uaString) || realOsHeader === 'iOS';
    const validDesktopRealOs = !isIosBrowserUa && (realOsHeader === 'Windows' || realOsHeader === 'macOS' || realOsHeader === 'Linux');
    deviceType = isIosBrowserUa ? (/iPad/i.test(uaString) ? 'tablet' : 'mobile') : validDesktopRealOs ? 'desktop' : (result.device.type || (uaString.includes('Mobile') ? 'mobile' : 'desktop'));
    os = isIosBrowserUa ? 'iOS' : validDesktopRealOs ? realOsHeader : (result.os.name || 'Unknown OS');
    
    // Prioritize the precise Client Hints browser name (e.g. 'Brave', 'Microsoft Edge') over spoofed UA string
    if (customBrowser) {
       browser = customBrowser;
    } else {
       const iosUaBr = /CriOS/i.test(uaString) ? 'Chrome' : /FxiOS/i.test(uaString) ? 'Firefox' : /EdgiOS/i.test(uaString) ? 'Microsoft Edge' : /OPiOS/i.test(uaString) ? 'Opera' : null;
       browser = iosUaBr || (result.browser.name ? result.browser.name.replace(/^Mobile\s+/i, '') : (isIosBrowserUa ? 'Safari' : 'Unknown Browser'));
    }
    if (isIosBrowserUa && browser) {
       userAgent = `${browser} on iOS`;
    } else if (validDesktopRealOs && browser) {
       userAgent = `${browser} on ${realOsHeader}`;
    }
  }

  return { userAgent, ipAddress, location, os, browser, deviceType };
}
