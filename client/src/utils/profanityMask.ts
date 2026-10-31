/**
 * Universal Profanity Masking Engine for AttendX.
 * Automatically masks offensive words and vulgarities with asterisks (e.g. "fuck you" -> "f**k you"),
 * bringing parity between Mobile (where Android OS masks speech) and Laptop/Web desktop browser.
 */

const PROFANITY_WORDS = [
  "motherfucker", "dickhead", "bullshit", "bitching", "fucking", "fucker", "asshole",
  "bastard", "dumbass", "nigger", "gaandmara", "gandmara", "bhosdiwale", "bhosdike",
  "madarchod", "behenchod", "bhenchod", "bakchodi", "chutiye", "chutiya", "bakchod",
  "harami", "kamina", "kamine", "bhosda", "gandwe", "lavde", "laude", "saale", "saala",
  "randi", "raand", "tatte", "jhaat", "jhantu", "gaand", "gandu", "fuck", "bitch", "shit",
  "dick", "cunt", "slut", "whore", "lodu", "lode", "lund", "stfu", "nigga", "retard", "fag",
  "mc", "bc"
];

function starWord(w: string): string {
  if (w.length <= 2) {
    return w[0] + "*";
  }
  return w[0] + "*".repeat(w.length - 2) + w[w.length - 1];
}

export function maskProfanity(text: string): string {
  if (!text) return "";
  let result = text;

  // 1. English & Hinglish words with boundary checks
  for (const word of PROFANITY_WORDS) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(reg, (match) => starWord(match));
  }

  // 2. Hindi Devanagari profanity
  const HINDI_PROFANITY = ["चूतिया", "मादरचोद", "बहनचोद", "भोसड़ीके", "भोसड़ीवाले", "गांडू", "गांड", "लौड़े", "लवड़े", "लंड", "हरामी", "कमीना", "रंडी", "झांट", "बकचोद", "चूत", "गाली"];
  for (const word of HINDI_PROFANITY) {
    const reg = new RegExp(word, "g");
    result = result.replace(reg, (match) => {
      const chars = Array.from(match);
      if (chars.length <= 2) return chars[0] + "*";
      return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
    });
  }

  return result;
}

/**
 * Checks whether text contains raw OR pre-starred abuse (from Android SpeechRecognizer or desktop masking).
 */
export const TOXIC_PATTERN =
  /\b(fuck|fucking|fucker|shit|bullshit|bitch|bitching|asshole|dick|dickhead|cunt|slut|whore|bastard|motherfucker|stfu|dumbass|idiot|retard|fag|nigger|nigga|madarchod|mc|behenchod|bhenchod|bc|bhosdike|bhosdiwale|bhosda|chutiya|chutiye|gaand|gandu|gandwe|lavde|laude|lodu|lode|lund|jhantu|harami|kamina|kamine|saala|saale|randi|raand|tatte|jhaat|bakchod|bakchodi|gaandmara|gandmara)\b|(?:^|\s|[.,!?])(f[\*]{2,}[a-z]?|f[\*]+(?:ing|er|ed|g)?|b[\*]{2,}[a-z]?|s[\*]{2,}[a-z]?|a[\*]{2,}[a-z]?|d[\*]{2,}[a-z]?|m[\*]{2,}[a-z]?|c[\*]{2,}[a-z]?|l[\*]{2,}[a-z]?)(?:$|\s|[.,!?])|[\u0900-\u097F]*(?:चूतिया|मादरचोद|बहनचोद|भोसड़ीके|भोसड़ीवाले|गांडू|गांड|लौड़े|लवड़े|लंड|हरामी|कमीना|रंडी|झांट|बकचोद|चूत|गाली)[\u0900-\u097F]*/i;
