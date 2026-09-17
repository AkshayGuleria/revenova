import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * SSRF guard for user-supplied outbound URLs (webhook subscribers).
 *
 * Without it, a caller registers http://169.254.169.254/… or an internal
 * address, the server fetches it, and the response body is stored and
 * readable — exfiltrating cloud credentials or reaching internal services.
 */

/** Resolves a hostname to IP strings. Injectable so tests stay hermetic. */
export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // drop zone id

  if (addr === '::' || addr === '::1') return true;

  // IPv4-mapped (::ffff:10.0.0.1) and IPv4-compatible forms
  const mapped = addr.match(/^::(ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[2]);

  if (/^f[cd]/.test(addr)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  if (/^ff/.test(addr)) return true; // multicast
  return false;
}

/** True when the address is loopback, private, link-local, CGNAT or reserved. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4IsPrivate(ip);
  if (version === 6) return ipv6IsPrivate(ip);
  return true; // unparseable — refuse rather than guess
}

/**
 * Throws unless `url` is http(s) and every address it resolves to is public.
 *
 * Call this immediately before each request, not only at registration: DNS can
 * be re-pointed at an internal address after a URL is stored (DNS rebinding).
 * Error messages never include the resolved address.
 */
export async function assertPublicHttpUrl(
  url: string,
  resolver: HostResolver = defaultResolver,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Webhook URL is not a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `Webhook URL scheme "${parsed.protocol}" is not allowed; use http or https.`,
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new BadRequestException(
        'Webhook URL points at a private or reserved address, which is not allowed.',
      );
    }
    return;
  }

  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new BadRequestException(
      `Webhook URL host "${hostname}" could not be resolved.`,
    );
  }

  if (addresses.length === 0) {
    throw new BadRequestException(
      `Webhook URL host "${hostname}" could not be resolved.`,
    );
  }

  if (addresses.some(isPrivateAddress)) {
    throw new BadRequestException(
      `Webhook URL host "${hostname}" resolves to a private or reserved address, which is not allowed.`,
    );
  }
}
