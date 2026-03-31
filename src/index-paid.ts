#!/usr/bin/env node
/**
 * index-paid.ts — Tomopay payment-gated entry point for resend-mcp
 *
 * Wraps the standard resend-mcp server with per-tool payment gating via
 * @tomopay/gateway. Agents pay per call (x402 USDC on Base, or MPP).
 *
 * Usage (stdio):
 *   RESEND_API_KEY=re_xxx TOMOPAY_ADDRESS=0x... node dist/index-paid.js
 *
 * Usage (HTTP):
 *   TOMOPAY_ADDRESS=0x... node dist/index-paid.js --http --port 3000
 */
import 'dotenv/config';
import { Resend } from 'resend';
import { withPayments } from '@tomopay/gateway';
import { parseArgs, resolveConfigOrExit } from './cli/index.js';
import { createMcpServer } from './server.js';
import { runHttp } from './transports/http.js';
import { runStdio } from './transports/stdio.js';

const parsed = parseArgs(process.argv.slice(2));
const config = resolveConfigOrExit(parsed, process.env);
const serverOptions = {
  senderEmailAddress: config.senderEmailAddress,
  replierEmailAddresses: config.replierEmailAddresses,
};

function onFatal(err: unknown): void {
  console.error(
    'Fatal error:',
    err instanceof Error ? err.message : 'unexpected error',
  );
  process.exit(1);
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Pricing rationale:
//   Resend charges ~$0.001-$0.002/email at API level.
//   send-email / send-batch-emails carry the highest value -> $0.03/call.
//   Read/list operations are lightweight -> $0.01/call.
const PRICING: Record<string, { amount: number; currency: string }> = {
  // Email actions
  'send-email':                       { amount: 3,  currency: 'USD' }, // $0.03
  'send-batch-emails':                { amount: 3,  currency: 'USD' }, // $0.03
  'list-emails':                      { amount: 1,  currency: 'USD' }, // $0.01
  'get-email':                        { amount: 1,  currency: 'USD' }, // $0.01
  'cancel-email':                     { amount: 1,  currency: 'USD' }, // $0.01
  'update-email':                     { amount: 1,  currency: 'USD' }, // $0.01
  'list-received-emails':             { amount: 1,  currency: 'USD' }, // $0.01
  'get-received-email':               { amount: 1,  currency: 'USD' }, // $0.01
  'list-received-email-attachments':  { amount: 1,  currency: 'USD' }, // $0.01
  'get-received-email-attachment':    { amount: 1,  currency: 'USD' }, // $0.01
  'list-sent-email-attachments':      { amount: 1,  currency: 'USD' }, // $0.01
  'get-sent-email-attachment':        { amount: 1,  currency: 'USD' }, // $0.01
  // Broadcasts
  'create-broadcast':                 { amount: 1,  currency: 'USD' }, // $0.01
  'send-broadcast':                   { amount: 3,  currency: 'USD' }, // $0.03
  'list-broadcasts':                  { amount: 1,  currency: 'USD' }, // $0.01
  'get-broadcast':                    { amount: 1,  currency: 'USD' }, // $0.01
  'update-broadcast':                 { amount: 1,  currency: 'USD' }, // $0.01
  'remove-broadcast':                 { amount: 1,  currency: 'USD' }, // $0.01
  // Contacts
  'create-contact':                   { amount: 1,  currency: 'USD' }, // $0.01
  'list-contacts':                    { amount: 1,  currency: 'USD' }, // $0.01
  'get-contact':                      { amount: 1,  currency: 'USD' }, // $0.01
  'update-contact':                   { amount: 1,  currency: 'USD' }, // $0.01
  'remove-contact':                   { amount: 1,  currency: 'USD' }, // $0.01
  // Domains
  'create-domain':                    { amount: 1,  currency: 'USD' }, // $0.01
  'list-domains':                     { amount: 1,  currency: 'USD' }, // $0.01
  'get-domain':                       { amount: 1,  currency: 'USD' }, // $0.01
  'update-domain':                    { amount: 1,  currency: 'USD' }, // $0.01
  'remove-domain':                    { amount: 1,  currency: 'USD' }, // $0.01
  'verify-domain':                    { amount: 1,  currency: 'USD' }, // $0.01
};

async function main() {
  if (config.transport === 'http') {
    // HTTP mode: create a base server for wrapping, then run gated HTTP transport.
    // Per-session Resend clients are still created in the transport layer.
    const resend = new Resend('placeholder'); // replaced per-session in HTTP transport
    const server = createMcpServer(resend, serverOptions);

    const { server: gatedServer } = withPayments(server, {
      payTo: process.env.TOMOPAY_ADDRESS,
      protocols: ['x402', 'mpp'],
      pricing: PRICING,
    });

    // @ts-expect-error -- gatedServer is a wrapped McpServer, compatible with runHttp
    runHttp(gatedServer, serverOptions, config.port).catch(onFatal);
  } else {
    // Stdio mode: single user, API key required at startup.
    const resend = new Resend(config.apiKey);
    const server = createMcpServer(resend, serverOptions);

    const { server: gatedServer } = withPayments(server, {
      payTo: process.env.TOMOPAY_ADDRESS,
      protocols: ['x402', 'mpp'],
      pricing: PRICING,
    });

    // @ts-expect-error -- gatedServer is a wrapped McpServer, compatible with runStdio
    runStdio(gatedServer, serverOptions).catch(onFatal);
  }
}

main().catch(onFatal);