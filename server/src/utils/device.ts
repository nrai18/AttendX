import { Request } from "express";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";

export const extractDeviceInfo = (req: Request) => {
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "";
  
  // Clean up IPv6 localhost mappings
  const cleanIp = ipAddress.includes(":") ? ipAddress.split(":").pop() || ipAddress : ipAddress;

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  let deviceType = result.device.type || "desktop";
  if (userAgent.includes("AttendX") || userAgent.includes("Capacitor")) {
    deviceType = "mobile";
  }

  const os = result.os.name || "Unknown OS";
  const browser = userAgent.includes("AttendX") ? "AttendX App" : (result.browser.name || "Unknown Browser");

  let location = "Unknown Location";
  if (cleanIp && cleanIp !== "1" && cleanIp !== "127.0.0.1") {
    const geo = geoip.lookup(cleanIp);
    if (geo) {
      location = `${geo.city || "Unknown City"}, ${geo.country || "Unknown Country"}`;
    }
  }

  return {
    userAgent,
    ipAddress: cleanIp,
    location,
    deviceType,
    os,
    browser
  };
};
