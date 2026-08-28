import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

export function getDeviceDetails(req: any) {
  if (!req) return { userAgent: 'Unknown OS', ipAddress: null, location: null };
  const uaString = req.headers['user-agent'] || '';
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  let userAgent = 'Unknown OS';
  if (uaString.includes('Capacitor') || uaString.includes('AttendX')) {
    if (uaString.includes('Android')) userAgent = 'AttendX App (Android)';
    else if (uaString.includes('iPhone') || uaString.includes('iPad')) userAgent = 'AttendX App (iOS)';
    else userAgent = 'AttendX App';
  } else if (result.browser.name) {
    userAgent = result.browser.name + (result.os.name ? ' on ' + result.os.name : '');
  } else if (result.os.name) {
    userAgent = result.os.name;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) || null;
  let location = 'Unknown Location';
  if (ipAddress) {
    const geo = geoip.lookup(ipAddress);
    if (geo) location = [geo.city, geo.country].filter(Boolean).join(', ');
    else if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.')) location = 'Local Network';
  }
  return { userAgent, ipAddress, location };
}