import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

export async function getDeviceDetails(req: any) {
  if (!req) return { userAgent: 'Unknown OS', ipAddress: null, location: null };
  const uaString = req.headers['user-agent'] || '';
  
  const platformHeader = req.headers['x-attendx-platform'];
  const osHeader = req.headers['x-attendx-os'];

  let userAgent = 'Unknown OS';
  if (platformHeader && osHeader) {
     userAgent = `${platformHeader} (${osHeader === 'web' ? 'Browser' : osHeader})`;
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
        headers: { 'User-Agent': 'AttendX App' }
      });
      const data = await response.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.county;
        const state = data.address.state;
        if (city && state) location = `${city}, ${state}`;
        else if (data.display_name) location = data.display_name.split(',').slice(0, 2).join(',');
      }
    } catch (e) {
      console.error('Nominatim error:', e);
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

  // Priority 3: geoip as absolute last resort (only if timezone also absent)
  if (location === 'Unknown Location' && ipAddress) {
    const geo = geoip.lookup(ipAddress);
    if (geo && geo.city) location = [geo.city, geo.country].filter(Boolean).join(', ');
    else if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.')) location = 'Local Network';
  }


  let os = null;
  let browser = null;
  let deviceType = null;
  
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  if (platformHeader && osHeader && osHeader !== 'web') {
     // Native Mobile App
     deviceType = platformHeader.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
     
     // Capitalize os (e.g. android -> Android, ios -> iOS)
     os = osHeader.toLowerCase() === 'ios' ? 'iOS' : osHeader.charAt(0).toUpperCase() + osHeader.slice(1);
     browser = 'AttendX App';
  } else {
    // Web Browser (or missing headers)
    deviceType = result.device.type || (uaString.includes('Mobile') ? 'mobile' : 'desktop');
    os = result.os.name || 'Unknown OS';
    browser = result.browser.name || 'Unknown Browser';
    if (uaString.includes('Capacitor') || uaString.includes('AttendX')) {
      browser = 'AttendX App';
    }
  }

  return { userAgent, ipAddress, location, os, browser, deviceType };
}