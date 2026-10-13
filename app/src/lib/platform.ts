/** Small wrappers for things that differ between the web and phones: links, calls, sharing, files. */
import * as Clipboard from 'expo-clipboard';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform, Share } from 'react-native';

/**
 * False only on an Android build made without a Google Maps key (app.config.js): creating the
 * map view there fails or draws a grey box, so the map screen shows its list instead.
 */
export const MAP_AVAILABLE =
  Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.expoConfig?.extra?.androidMapsKey === true;

/** Opens a link in a new tab on the web (without giving the new page access to this one). */
export async function openUrl(url: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Digits only, so "(510) 574-2041" dials correctly. Short codes such as 211 and 988 work too. */
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export async function callPhone(phone: string): Promise<boolean> {
  try {
    await Linking.openURL(telUrl(phone));
    return true;
  } catch {
    return false;
  }
}

export function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function openMail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    await Linking.openURL(mailtoUrl(to, subject, body));
    return true;
  } catch {
    return false;
  }
}

/** Directions by street address, so the destination is right even where our map pin is approximate. */
export function directionsUrl(address: string) {
  const destination = encodeURIComponent(address);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${destination}` : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/** Uses the system share sheet where there is one; otherwise copies the text. Returns what happened. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text });
        return 'shared';
      }
      return (await copyText(text)) ? 'copied' : 'failed';
    }
    await Share.share({ title, message: text });
    return 'shared';
  } catch {
    // The person closed the share sheet, or sharing is blocked: fall back to copying.
    return (await copyText(text)) ? 'copied' : 'failed';
  }
}

/** Saves text as a file on the web; on phones, hands it to the share sheet so it can be saved or sent. */
export async function saveTextFile(filename: string, text: string, mime: string): Promise<'saved' | 'shared' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return 'saved';
    }
    await Share.share({ title: filename, message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
