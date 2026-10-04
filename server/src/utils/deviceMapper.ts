import fs from 'fs';
import path from 'path';

let deviceMap = new Map<string, string>();

/**
 * Fetches and parses Google's official supported devices CSV (UTF-16 LE).
 * Maps the raw hardware model (e.g. CPH2573) to Marketing Name (e.g. OnePlus 12).
 */
export async function loadDeviceMapping() {
  try {
    const response = await fetch('https://storage.googleapis.com/play_public/supported_devices.csv');
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder('utf-16le').decode(buffer);
    
    const lines = text.split('\n');
    let loaded = 0;
    
    for (let i = 1; i < lines.length; i++) { // skip header
      const line = lines[i].trim();
      if (!line) continue;
      
      // The CSV format: "Retail Branding","Marketing Name","Device","Model"
      const columns = line.split('","').map(c => c.replace(/(^"|"$)/g, ''));
      if (columns.length >= 4) {
        const brand = columns[0];
        const marketingName = columns[1] || brand;
        const model = columns[3];
        
        if (model) {
          deviceMap.set(model.toUpperCase(), marketingName);
          loaded++;
        }
      }
    }
    console.log(`[DeviceMapper] Successfully cached ${loaded} Android marketing names from Google Play.`);
  } catch (error) {
    console.error('[DeviceMapper] Failed to load Google Play devices list:', error);
  }
}

export function getMarketingName(model: string, manufacturer?: string): string {
  if (!model) return 'Unknown Device';
  
  const lookup = model.toUpperCase();
  if (deviceMap.has(lookup)) {
    return deviceMap.get(lookup) as string;
  }
  
  // Fallback if not found
  if (manufacturer) {
    const cleanManufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
    return `${cleanManufacturer} ${model}`;
  }
  return model;
}
