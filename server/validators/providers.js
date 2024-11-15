export const PROVIDERS = {
  'gmail.com': {
    domains: ['gmail.com', 'googlemail.com'],
    mxDomains: ['google.com', 'googlemail.com', 'gmail.com'],
    reliable: true,
    heloHost: 'gmail-smtp-in.l.google.com',
    verifyMailbox: true,
    requireTLS: true,
    rejectCatchAll: true,
    timeout: 15000,
    acceptCodes: [250],
    rejectCodes: [550, 551, 552, 553, 554],
    retryAttempts: 2
  },
  'outlook.com': {
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    mxDomains: ['outlook.com', 'hotmail.com', 'microsoft.com'],
    reliable: true,
    heloHost: 'outlook-com.olc.protection.outlook.com',
    verifyMailbox: true,
    requireTLS: false,
    rejectCatchAll: true,
    timeout: 30000,
    acceptCodes: [250, 251, 252],
    rejectCodes: [550, 551, 552, 553, 554],
    retryAttempts: 3,
    customValidation: true
  },
  'yahoo.com': {
    domains: ['yahoo.com', 'ymail.com'],
    mxDomains: ['yahoo.com', 'yahoodns.net'],
    reliable: true,
    heloHost: 'mta7.am0.yahoodns.net',
    verifyMailbox: true,
    requireTLS: true,
    rejectCatchAll: true,
    timeout: 12000,
    acceptCodes: [250],
    rejectCodes: [550, 551, 552, 553, 554],
    retryAttempts: 2
  }
};

export function getProviderConfig(domain) {
  const lowerDomain = domain.toLowerCase();
  
  // Check exact domain matches
  for (const [provider, config] of Object.entries(PROVIDERS)) {
    if (config.domains.includes(lowerDomain)) {
      return { ...config, provider };
    }
  }
  
  // Check MX domain patterns
  for (const [provider, config] of Object.entries(PROVIDERS)) {
    if (config.mxDomains.some(mxDomain => lowerDomain.includes(mxDomain))) {
      return { ...config, provider };
    }
  }
  
  // Generic provider configuration
  return {
    reliable: false,
    verifyMailbox: true,
    requireTLS: false,
    rejectCatchAll: true,
    timeout: 10000,
    acceptCodes: [250, 251, 252],
    rejectCodes: [550, 551, 552, 553, 554],
    retryAttempts: 2,
    provider: 'generic'
  };
}