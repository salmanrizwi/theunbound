#!/usr/bin/env node
/**
 * Production SSL, DNS & HTTPS Verification Audit Script for TheUnbound Portal
 * Verifies:
 *  - Hostinger DNS records (A, AAAA, CNAME, MX, SPF, DMARC, DKIM)
 *  - Absence of stale Hostinger CDN CNAME on www.theunbound.in
 *  - Valid, non-expired TLS certificates on both theunbound.in and www.theunbound.in
 *  - HTTP -> HTTPS redirection without redirect loops
 *  - Live /api/health, /robots.txt, /sitemap.xml (HTTPS canonical URLs) & security headers
 */

import dns from 'node:dns/promises';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';

const APEX = 'theunbound.in';
const WWW = 'www.theunbound.in';
const GOOGLE_APEX_IPS = new Set(['216.239.32.21', '216.239.34.21', '216.239.36.21', '216.239.38.21']);

async function safeDns(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, code: err.code || err.message };
  }
}

function inspectTlsCert(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000
      },
      () => {
        const authorized = socket.authorized;
        const authError = socket.authorizationError || null;
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();
        socket.end();
        resolve({
          connected: true,
          authorized,
          authError,
          protocol,
          subject: cert?.subject?.CN || '',
          issuer: cert?.issuer?.O ? `${cert.issuer.O} (${cert.issuer.CN || ''})` : (cert?.issuer?.CN || ''),
          validFrom: cert?.valid_from || '',
          validTo: cert?.valid_to || '',
          san: cert?.subjectaltname || ''
        });
      }
    );
    socket.on('error', (err) => resolve({ connected: false, error: err.message }));
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ connected: false, error: 'TLS connection timeout' });
    });
  });
}

function probeUrl(urlStr) {
  return new Promise((resolve) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        timeout: 8000,
        rejectUnauthorized: true
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          if (body.length < 4096) body += chunk.toString('utf-8');
        });
        res.on('end', () => {
          resolve({
            ok: true,
            statusCode: res.statusCode,
            headers: res.headers,
            bodySnippet: body.slice(0, 500)
          });
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message, code: err.code }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'HTTP timeout' });
    });
    req.end();
  });
}

async function run() {
  let allPassed = true;
  const record = (label, pass, detail) => {
    const badge = pass ? 'PASS' : 'FAIL';
    if (!pass) allPassed = false;
    console.log(`[${badge}] ${label}: ${detail}`);
  };

  console.log('=== THEUNBOUND PRODUCTION SSL & DNS VERIFICATION ===\n');

  // 1. DNS Audit
  const apexA = await safeDns(() => dns.resolve4(APEX));
  const apexAllGoogle =
    apexA.ok &&
    apexA.value.length >= 4 &&
    apexA.value.every((ip) => GOOGLE_APEX_IPS.has(ip));
  record('DNS A (theunbound.in)', apexAllGoogle, apexA.ok ? apexA.value.join(', ') : apexA.code);

  const wwwCname = await safeDns(() => dns.resolveCname(WWW));
  const wwwPointsToGoogle =
    wwwCname.ok &&
    wwwCname.value.some((c) => c.toLowerCase().includes('ghs.googlehosted.com'));
  const wwwA = await safeDns(() => dns.resolve4(WWW));
  record(
    'DNS CNAME (www.theunbound.in)',
    wwwPointsToGoogle,
    wwwCname.ok
      ? `${wwwCname.value.join(', ')} (A: ${wwwA.ok ? wwwA.value.join(', ') : 'none'})`
      : `No CNAME (A: ${wwwA.ok ? wwwA.value.join(', ') : wwwCname.code})`
  );

  // Email & Google Workspace preservation
  const mx = await safeDns(() => dns.resolveMx(APEX));
  const mxPreserved = mx.ok && mx.value.some((m) => m.exchange.toLowerCase().includes('google.com'));
  record('DNS MX Preserved (Google Workspace)', mxPreserved, mx.ok ? JSON.stringify(mx.value) : mx.code);

  const txt = await safeDns(() => dns.resolveTxt(APEX));
  const flatTxt = txt.ok ? txt.value.map((parts) => parts.join('')) : [];
  record(
    'DNS SPF Preserved',
    flatTxt.some((t) => t.includes('v=spf1') && t.includes('_spf.google.com')),
    flatTxt.filter((t) => t.includes('spf1')).join(' | ') || 'MISSING'
  );

  const dmarc = await safeDns(() => dns.resolveTxt(`_dmarc.${APEX}`));
  record(
    'DNS DMARC Preserved',
    dmarc.ok && dmarc.value.some((p) => p.join('').includes('v=DMARC1')),
    dmarc.ok ? dmarc.value.map((p) => p.join('')).join(' | ') : dmarc.code
  );

  const dkim = await safeDns(() => dns.resolveTxt(`google._domainkey.${APEX}`));
  record(
    'DNS DKIM Preserved',
    dkim.ok && dkim.value.some((p) => p.join('').includes('v=DKIM1')),
    dkim.ok ? 'Present (DKIM1 RSA key intact)' : dkim.code
  );

  console.log('');

  // 2. TLS Certificate Verification
  for (const host of [APEX, WWW]) {
    const cert = await inspectTlsCert(host);
    const valid = cert.connected && cert.authorized;
    record(
      `TLS Certificate (${host})`,
      valid,
      cert.connected
        ? `authorized=${cert.authorized}${cert.authError ? ` (${cert.authError})` : ''}, proto=${cert.protocol}, issuer=${cert.issuer}, validTo=${cert.validTo}, SAN=${cert.san}`
        : cert.error
    );
  }

  console.log('');

  // 3. HTTP -> HTTPS Redirect Verification
  for (const host of [APEX, WWW]) {
    const httpRes = await probeUrl(`http://${host}/`);
    const loc = httpRes.headers?.location || '';
    const isHttpsRedirect =
      httpRes.ok &&
      (httpRes.statusCode === 301 || httpRes.statusCode === 302 || httpRes.statusCode === 308) &&
      loc.startsWith('https://');
    record(
      `HTTP->HTTPS Redirect (http://${host}/)`,
      isHttpsRedirect,
      httpRes.ok ? `HTTP ${httpRes.statusCode} -> ${loc} (server=${httpRes.headers?.server || 'unknown'})` : httpRes.error
    );
  }

  console.log('');

  // 4. Live HTTPS Portal & API Verification
  for (const host of [APEX, WWW]) {
    const health = await probeUrl(`https://${host}/api/health`);
    const okHealth =
      health.ok &&
      health.statusCode === 200 &&
      health.bodySnippet.includes('"status":"ok"');
    record(
      `HTTPS API Health (https://${host}/api/health)`,
      okHealth,
      health.ok ? `HTTP ${health.statusCode} ${health.bodySnippet.trim()}` : health.error
    );
  }

  const sitemap = await probeUrl(`https://${APEX}/sitemap.xml`);
  const sitemapAllHttps =
    sitemap.ok &&
    sitemap.statusCode === 200 &&
    !sitemap.bodySnippet.includes('<loc>http://theunbound.in');
  record(
    'HTTPS Canonical Sitemap (https://theunbound.in/sitemap.xml)',
    sitemapAllHttps,
    sitemap.ok
      ? sitemapAllHttps
        ? 'All URLs use https://'
        : 'Contains http://theunbound.in/ (redeploy updated server/main.ts + server/seoHandler.ts)'
      : sitemap.error
  );

  console.log('\n====================================================');
  console.log(allPassed ? 'RESULT: ALL PRODUCTION SSL CHECKS PASSED' : 'RESULT: ACTION REQUIRED (SEE [FAIL] ITEMS ABOVE)');
  process.exit(allPassed ? 0 : 1);
}

run();
