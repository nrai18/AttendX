import { getMarketingName } from './deviceMapper';
import { UAParser } from 'ua-parser-js';

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
  
  if (lat && lon) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, {
        headers: { 'User-Agent': 'AttendXApp/1.0 (admin@attendx.tech)' },
        signal: AbortSignal.timeout(1500)
      });
      const data = await response.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.county;
        const state = data.address.state;
        if (city && state) location = `${city}, ${state}`;
        else if (data.display_name) location = data.display_name.split(',').slice(0, 2).join(',');
      }
    } catch (e) {
      console.warn('Nominatim lookup skipped or timed out:', (e as any)?.message || e);
    }
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) || null;

  const timezone = req.headers['x-attendx-timezone'];

  // Priority 1: GPS-based Nominatim (already set above if lat/lon provided)

  // Priority 2: Timezone header (much more reliable than geoip for most requests)
  if (location === 'Unknown Location' && typeof timezone === 'string') {
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
    // Web Browser (Laptop or Mobile Web)
    deviceType = result.device.type || (uaString.includes('Mobile') ? 'mobile' : 'desktop');
    os = result.os.name || 'Unknown OS';
    
    // Prioritize the precise Client Hints browser name (e.g. 'Brave', 'Microsoft Edge') over spoofed UA string
    if (customBrowser) {
       browser = customBrowser;
    } else {
       browser = result.browser.name || 'Unknown Browser';
    }
  }

  return { userAgent, ipAddress, location, os, browser, deviceType };
}
