import { BadRequestException } from '@nestjs/common';
import { assertPublicHttpUrl, isPrivateAddress } from './assert-public-url';

describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['0.0.0.0', 'unspecified'],
    ['10.1.2.3', 'RFC1918 /8'],
    ['172.16.0.1', 'RFC1918 /12 lower bound'],
    ['172.31.255.254', 'RFC1918 /12 upper bound'],
    ['192.168.1.1', 'RFC1918 /16'],
    ['169.254.169.254', 'cloud metadata'],
    ['100.64.0.1', 'CGNAT'],
    ['::1', 'IPv6 loopback'],
    ['fd00::1', 'IPv6 unique local'],
    ['fe80::1', 'IPv6 link-local'],
  ])('treats %s as private (%s)', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ['93.184.216.34'],
    ['8.8.8.8'],
    ['172.32.0.1'],
    ['2606:2800:220:1::'],
  ])('treats %s as public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  const resolvesTo = (ip: string) => async () => [ip];

  it('rejects a non-http(s) scheme', async () => {
    await expect(
      assertPublicHttpUrl('file:///etc/passwd', resolvesTo('93.184.216.34')),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a literal private address', async () => {
    await expect(
      assertPublicHttpUrl(
        'http://169.254.169.254/latest/meta-data/',
        resolvesTo('169.254.169.254'),
      ),
    ).rejects.toThrow(/not allowed/i);
  });

  it('rejects a hostname that resolves to a private address', async () => {
    await expect(
      assertPublicHttpUrl(
        'https://evil.example.com/hook',
        resolvesTo('10.0.0.5'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when any resolved address is private', async () => {
    const mixed = async () => ['93.184.216.34', '127.0.0.1'];
    await expect(
      assertPublicHttpUrl('https://evil.example.com/hook', mixed),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a hostname that resolves to a public address', async () => {
    await expect(
      assertPublicHttpUrl(
        'https://hooks.example.com/x',
        resolvesTo('93.184.216.34'),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects when the hostname cannot be resolved', async () => {
    const fails = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(
      assertPublicHttpUrl('https://nope.example.com/x', fails),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not leak the resolved address in the error message', async () => {
    await expect(
      assertPublicHttpUrl(
        'https://evil.example.com/hook',
        resolvesTo('10.11.12.13'),
      ),
    ).rejects.not.toThrow(/10\.11\.12\.13/);
  });
});
