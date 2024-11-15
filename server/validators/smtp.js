import net from 'net';
import tls from 'tls';
import { proxyManager } from '../lib/proxyManager.js';
import debug from 'debug';

const log = debug('email:smtp');
const TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const VALID_DOMAINS = [
  'salesforce.com',
  'sendgrid.net',
  'mailchimp.com',
  'amazonses.com',
  'postmarkapp.com'
];

async function writeCommand(socket, command) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.destroyed) {
      reject(new Error('Socket is closed'));
      return;
    }

    socket.write(command + '\r\n', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function readResponse(socket, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.removeAllListeners('data');
      reject(new Error('Response timeout'));
    }, timeout);

    let response = '';
    
    function handleData(data) {
      response += data.toString();
      if (response.includes('\r\n')) {
        const lines = response.split('\r\n');
        for (const line of lines) {
          if (line.match(/^[0-9]{3}(?:[ -].*)?$/)) {
            clearTimeout(timeoutId);
            socket.removeListener('data', handleData);
            resolve(line);
            return;
          }
        }
      }
    }

    socket.on('data', handleData);
  });
}

async function upgradeToTLS(socket, host) {
  return new Promise((resolve, reject) => {
    const tlsOptions = {
      socket,
      host,
      rejectUnauthorized: false
    };

    const tlsSocket = tls.connect(tlsOptions, () => {
      resolve(tlsSocket);
    });

    tlsSocket.once('error', reject);
  });
}

export async function verifyMailbox(host, email, domain, config = {}) {
  let socket = null;
  let currentProxy = null;
  let retryCount = 0;

  const cleanup = async () => {
    try {
      if (socket && !socket.destroyed) {
        try {
          await writeCommand(socket, 'QUIT');
          await readResponse(socket, 1000).catch(() => {});
        } finally {
          socket.end();
          socket.destroy();
        }
      }
    } catch (error) {
      log('Cleanup error:', error);
    }
  };

  while (retryCount < MAX_RETRIES) {
    try {
      currentProxy = proxyManager.getNextProxy();
      if (!currentProxy) {
        throw new Error('No available proxies');
      }

      socket = await proxyManager.createProxyConnection(currentProxy, host, 25);
      
      const greeting = await readResponse(socket, config.timeout || TIMEOUT);
      if (!greeting?.startsWith('220')) {
        throw new Error('Invalid server greeting');
      }

      await writeCommand(socket, `EHLO ${domain}`);
      let ehloResponse = await readResponse(socket, config.timeout || TIMEOUT);
      
      if (!ehloResponse.startsWith('250')) {
        await writeCommand(socket, `HELO ${domain}`);
        ehloResponse = await readResponse(socket, config.timeout || TIMEOUT);
        if (!ehloResponse.startsWith('250')) {
          throw new Error('HELO/EHLO failed');
        }
      }

      const fromDomain = VALID_DOMAINS[Math.floor(Math.random() * VALID_DOMAINS.length)];
      const fromAddress = `verify.${Math.random().toString(36).substring(2)}@${fromDomain}`;

      await writeCommand(socket, `MAIL FROM:<${fromAddress}>`);
      const fromResponse = await readResponse(socket, config.timeout || TIMEOUT);
      
      if (!fromResponse.startsWith('250')) {
        throw new Error('MAIL FROM failed');
      }

      await writeCommand(socket, `RCPT TO:<${email}>`);
      const rcptResponse = await readResponse(socket, config.timeout || TIMEOUT);
      
      const code = rcptResponse.substring(0, 3);
      const exists = code.startsWith('2') || code === '451' || code === '452';

      proxyManager.markProxySuccess(currentProxy);
      await cleanup();
      
      return {
        success: true,
        mailboxExists: exists,
        code: parseInt(code, 10),
        message: rcptResponse.substring(4)
      };
    } catch (error) {
      log(`Attempt ${retryCount + 1} failed:`, error.message);
      
      if (currentProxy) {
        proxyManager.markProxyFailure(currentProxy);
      }
      
      await cleanup();
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      }
    }
  }

  return {
    success: false,
    mailboxExists: false,
    error: `Verification failed after ${MAX_RETRIES} attempts`
  };
}

// Add verifyMailboxWithRetry as a wrapper around verifyMailbox
export async function verifyMailboxWithRetry(host, email, domain, config = {}) {
  let lastError;
  const maxRetries = config.provider === 'outlook.com' ? 5 : MAX_RETRIES;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const result = await verifyMailbox(host, email, domain, config);
      if (result.success) {
        return result;
      }
      lastError = new Error(result.error || 'Verification failed');
    } catch (error) {
      lastError = error;
      if (error.message.includes('connect')) {
        // Force proxy switch on connection errors
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      }
    }

    if (retryCount < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
    }
  }

  return {
    success: false,
    mailboxExists: false,
    error: lastError?.message || `Verification failed after ${maxRetries} attempts`
  };
}