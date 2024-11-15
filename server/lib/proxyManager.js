import fs from 'fs/promises';
import net from 'net';
import { SocksClient } from 'socks';
import debug from 'debug';

const log = debug('email:proxy');
const PROXY_TIMEOUT = 10000;
const MAX_FAILURES = 3;
const MAX_CONNECTIONS = 3;
const COOLDOWN_PERIOD = 30000;

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.activeConnections = new Map();
  }

  async loadProxies(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.proxies = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const [host, port, username, password] = line.split(':').map(s => s?.trim());
          return {
            host,
            port: parseInt(port, 10),
            username,
            password,
            failures: 0,
            lastUsed: 0,
            connections: 0
          };
        })
        .filter(proxy => proxy.host && !isNaN(proxy.port));

      log(`Loaded ${this.proxies.length} proxies`);
      return true;
    } catch (error) {
      log('Failed to load proxies:', error);
      return false;
    }
  }

  getNextProxy() {
    if (this.proxies.length === 0) {
      return null;
    }

    const now = Date.now();
    let attempts = 0;

    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      if (proxy.failures >= MAX_FAILURES || 
          proxy.connections >= MAX_CONNECTIONS || 
          now - proxy.lastUsed < COOLDOWN_PERIOD) {
        attempts++;
        continue;
      }

      proxy.lastUsed = now;
      proxy.connections++;
      return proxy;
    }

    // Reset all proxies if none are available
    if (this.proxies.every(p => p.failures >= MAX_FAILURES)) {
      log('Resetting all proxy failure counts');
      this.proxies.forEach(p => {
        p.failures = 0;
        p.connections = 0;
        p.lastUsed = 0;
      });
      return this.getNextProxy();
    }

    return null;
  }

  async createProxyConnection(proxy, targetHost, targetPort) {
    if (!proxy) {
      const directSocket = new net.Socket();
      return new Promise((resolve, reject) => {
        directSocket.connect(targetPort, targetHost, () => resolve(directSocket));
        directSocket.on('error', reject);
      });
    }

    try {
      const socksOptions = {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          type: 5,
          userId: proxy.username,
          password: proxy.password
        },
        command: 'connect',
        destination: {
          host: targetHost,
          port: targetPort
        },
        timeout: PROXY_TIMEOUT
      };

      const { socket } = await SocksClient.createConnection(socksOptions);
      
      socket.setKeepAlive(true, 1000);
      socket.setTimeout(PROXY_TIMEOUT);

      socket.on('error', (err) => {
        log(`Socket error for proxy ${proxy.host}:${proxy.port}:`, err.message);
        this.markProxyFailure(proxy);
      });

      socket.on('timeout', () => {
        log(`Socket timeout for proxy ${proxy.host}:${proxy.port}`);
        socket.destroy();
      });

      socket.on('close', () => {
        this.releaseProxy(proxy);
      });

      return socket;
    } catch (error) {
      this.markProxyFailure(proxy);
      throw error;
    }
  }

  markProxyFailure(proxy) {
    if (!proxy) return;
    proxy.failures++;
    proxy.connections = Math.max(0, proxy.connections - 1);
    log(`Proxy ${proxy.host}:${proxy.port} failure count: ${proxy.failures}`);
  }

  markProxySuccess(proxy) {
    if (!proxy) return;
    proxy.failures = 0;
  }

  releaseProxy(proxy) {
    if (!proxy) return;
    proxy.connections = Math.max(0, proxy.connections - 1);
    log(`Released proxy ${proxy.host}:${proxy.port}, connections: ${proxy.connections}`);
  }
}

export const proxyManager = new ProxyManager();