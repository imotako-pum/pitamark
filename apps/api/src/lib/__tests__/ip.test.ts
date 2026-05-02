import { describe, expect, it } from 'vitest';
import { extractClientIp, redactIp } from '../ip';

describe('redactIp', () => {
  it('masks the last octet of an IPv4 address', () => {
    expect(redactIp('1.2.3.4')).toBe('1.2.3.xxx');
    expect(redactIp('10.0.0.255')).toBe('10.0.0.xxx');
  });

  it('masks the last group of an IPv6 address', () => {
    expect(redactIp('2001:db8::1')).toBe('2001:db8::xxx');
    expect(redactIp('fe80::1234:5678:abcd')).toBe('fe80::1234:5678:xxx');
  });

  it("returns 'unknown' for null / undefined / empty", () => {
    expect(redactIp(null)).toBe('unknown');
    expect(redactIp(undefined)).toBe('unknown');
    expect(redactIp('')).toBe('unknown');
  });

  it("returns 'redacted' for unrecognised formats so logs never leak raw input", () => {
    expect(redactIp('definitely-not-an-ip')).toBe('redacted');
  });
});

describe('extractClientIp', () => {
  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' },
    });
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to the first x-forwarded-for entry when cf header is absent', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
    });
    expect(extractClientIp(req)).toBe('5.6.7.8');
  });

  it('falls back to localhost when neither header is present', () => {
    const req = new Request('https://example.com');
    expect(extractClientIp(req)).toBe('127.0.0.1');
  });

  it('ignores empty cf-connecting-ip header values', () => {
    const req = new Request('https://example.com', {
      headers: { 'cf-connecting-ip': '', 'x-forwarded-for': '5.6.7.8' },
    });
    expect(extractClientIp(req)).toBe('5.6.7.8');
  });
});
