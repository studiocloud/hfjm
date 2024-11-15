import dns from 'dns';
import { promisify } from 'util';
import { verifyMailbox, verifyMailboxWithRetry } from './smtp.js';
import { getProviderConfig } from './providers.js';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

// Email format validation using RFC 5322 standard
const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,61}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
  return emailRegex.test(email);
};

// DNS record verification
const checkDNS = async (domain) => {
  try {
    const checks = [
      dns.promises.resolve(domain, 'A'),
      dns.promises.resolve(domain, 'AAAA'),
      dns.promises.resolve(domain, 'CNAME')
    ];
    const results = await Promise.allSettled(checks);
    return results.some(result => result.status === 'fulfilled');
  } catch {
    return false;
  }
};

// MX record verification
const checkMX = async (domain) => {
  try {
    const records = await resolveMx(domain);
    return records && records.length > 0 ? records.sort((a, b) => a.priority - b.priority) : false;
  } catch {
    return false;
  }
};

// SPF record verification
const checkSPF = async (domain) => {
  try {
    const txtRecords = await resolveTxt(domain);
    const spfRecord = txtRecords.flat().find(record => record.startsWith('v=spf1'));
    return {
      exists: !!spfRecord,
      record: spfRecord
    };
  } catch {
    return {
      exists: false,
      record: null
    };
  }
};

// Main validation function
export const validateEmail = async (email) => {
  const result = {
    email,
    valid: false,
    checks: {
      format: false,
      dns: false,
      mx: false,
      spf: false,
      smtp: false,
      mailbox: false,
      catchAll: false
    },
    details: {
      mxRecords: [],
      spfRecord: null,
      smtpResponse: null
    },
    reason: ''
  };

  try {
    // Step 1: Format Check
    result.checks.format = validateEmailFormat(email);
    if (!result.checks.format) {
      result.reason = 'Invalid email format';
      return result;
    }

    const [localPart, domain] = email.split('@');
    
    if (localPart.length > 64) {
      result.reason = 'Local part exceeds maximum length';
      return result;
    }
    
    if (domain.length > 255) {
      result.reason = 'Domain exceeds maximum length';
      return result;
    }

    // Step 2: DNS Check
    result.checks.dns = await checkDNS(domain);
    if (!result.checks.dns) {
      result.reason = 'Domain does not exist';
      return result;
    }

    // Step 3: MX Records Check
    const mxRecords = await checkMX(domain);
    if (!mxRecords) {
      result.reason = 'No mail servers found for domain';
      return result;
    }
    
    result.checks.mx = true;
    result.details.mxRecords = mxRecords;

    // Step 4: SPF Check
    const spfResult = await checkSPF(domain);
    result.checks.spf = spfResult.exists;
    result.details.spfRecord = spfResult.record;

    // Step 5: Get provider configuration
    const providerConfig = getProviderConfig(domain);

    // Step 6: SMTP and Mailbox Check
    let smtpSuccess = false;
    let lastError = null;

    for (const mx of mxRecords) {
      try {
        const verifyResult = providerConfig.provider === 'outlook.com'
          ? await verifyMailboxWithRetry(mx.exchange, email, domain, providerConfig)
          : await verifyMailbox(mx.exchange, email, domain, providerConfig);
        
        if (verifyResult.success) {
          result.checks.smtp = true;
          result.checks.mailbox = verifyResult.mailboxExists;
          result.checks.catchAll = verifyResult.isCatchAll;
          result.details.smtpResponse = verifyResult;
          
          if (verifyResult.isCatchAll && providerConfig.rejectCatchAll) {
            result.valid = false;
            result.reason = 'Catch-all domain detected';
            break;
          }

          if (result.checks.mailbox) {
            smtpSuccess = true;
            break;
          }
        }
        
        lastError = verifyResult.error;
      } catch (error) {
        lastError = error.message;
        continue;
      }
    }

    // Determine final validation status
    if (smtpSuccess) {
      result.valid = true;
      result.reason = 'Email is valid';
    } else if (result.checks.dns && result.checks.mx) {
      result.valid = false;
      result.reason = lastError || 'Failed to verify mailbox';
    } else {
      result.valid = false;
      result.reason = 'Domain validation failed';
    }

  } catch (error) {
    result.reason = `Validation error: ${error.message}`;
  }

  return result;
};