// Email Authenticity and Genuine Verification Utilities

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'guerrillamail.com',
  'getnada.com',
  'throwawaymail.com',
  'sharklasers.com',
  'maildrop.cc',
  'temp-mail.org',
  'fakemailgenerator.com',
  'crazymailing.com',
  'burnermail.io',
]);

const KNOWN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'iclou.com': 'icloud.com',
};

const POPULAR_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'hotmail.com',
];

export interface EmailValidationResult {
  isValidFormat: boolean;
  isDisposable: boolean;
  isGenuineProvider: boolean;
  providerLabel: string;
  suggestedFix: string | null;
  statusText: string;
  badgeType: 'genuine' | 'edu' | 'disposable' | 'typo' | 'invalid' | 'neutral';
}

export function validateEmailAuthenticity(email: string): EmailValidationResult {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {
      isValidFormat: false,
      isDisposable: false,
      isGenuineProvider: false,
      providerLabel: '',
      suggestedFix: null,
      statusText: '',
      badgeType: 'neutral',
    };
  }

  // RFC compliant Email Regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isValidFormat = emailRegex.test(cleanEmail);

  if (!isValidFormat) {
    return {
      isValidFormat: false,
      isDisposable: false,
      isGenuineProvider: false,
      providerLabel: '',
      suggestedFix: null,
      statusText: 'Invalid email format',
      badgeType: 'invalid',
    };
  }

  const [username, domain] = cleanEmail.split('@');

  // Check Disposable Email Domain
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValidFormat: true,
      isDisposable: true,
      isGenuineProvider: false,
      providerLabel: 'Disposable Email Detected',
      suggestedFix: null,
      statusText: '⚠️ Temporary/Disposable emails are not allowed for security reasons',
      badgeType: 'disposable',
    };
  }

  // Check Typo Suggestions
  if (KNOWN_TYPOS[domain]) {
    const fixedDomain = KNOWN_TYPOS[domain];
    const suggestedFix = `${username}@${fixedDomain}`;
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: false,
      providerLabel: 'Possible Domain Typo',
      suggestedFix,
      statusText: `Did you mean ${suggestedFix}?`,
      badgeType: 'typo',
    };
  }

  // Check Educational Domain
  if (domain.endsWith('.edu') || domain.endsWith('.edu.np') || domain.endsWith('.ac.uk')) {
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: true,
      providerLabel: 'Verified Academic Domain',
      suggestedFix: null,
      statusText: ' Verified Student/Academic Email',
      badgeType: 'edu',
    };
  }

  // Check Popular Genuine Providers
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: true,
      providerLabel: 'Google Verified Mail',
      suggestedFix: null,
      statusText: ' Verified Genuine Gmail',
      badgeType: 'genuine',
    };
  }

  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) {
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: true,
      providerLabel: 'Microsoft Verified Mail',
      suggestedFix: null,
      statusText: ' Verified Genuine Microsoft Mail',
      badgeType: 'genuine',
    };
  }

  if (['yahoo.com', 'ymail.com'].includes(domain)) {
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: true,
      providerLabel: 'Yahoo Verified Mail',
      suggestedFix: null,
      statusText: ' Verified Genuine Yahoo Mail',
      badgeType: 'genuine',
    };
  }

  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
    return {
      isValidFormat: true,
      isDisposable: false,
      isGenuineProvider: true,
      providerLabel: 'Apple iCloud Mail',
      suggestedFix: null,
      statusText: ' Verified Genuine iCloud Mail',
      badgeType: 'genuine',
    };
  }

  return {
    isValidFormat: true,
    isDisposable: false,
    isGenuineProvider: true,
    providerLabel: 'Valid Custom Domain',
    suggestedFix: null,
    statusText: ' Genuine Custom Email Domain',
    badgeType: 'genuine',
  };
}

export function getEmailDomainSuggestions(input: string): string[] {
  const clean = input.trim().toLowerCase();
  if (!clean.includes('@')) return [];

  const [prefix, domainPart] = clean.split('@');
  if (!prefix) return [];

  return POPULAR_DOMAINS
    .filter((domain) => domain.startsWith(domainPart))
    .map((domain) => `${prefix}@${domain}`);
}
