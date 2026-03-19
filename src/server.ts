import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Resend } from 'resend';
import packageJson from '../package.json' with { type: 'json' };
import { DashboardClient } from './lib/dashboard-client.js';
import {
  addApiKeyTools,
  addBroadcastTools,
  addContactPropertyTools,
  addContactTools,
  addDomainTools,
  addEditorTools,
  addEmailTools,
  addSegmentTools,
  addTopicTools,
  addWebhookTools,
} from './tools/index.js';
import type { ServerOptions } from './types.js';

export type { ServerOptions } from './types.js';

export function createMcpServer(
  resend: Resend,
  options: ServerOptions,
  apiKey?: string,
): McpServer {
  const { senderEmailAddress, replierEmailAddresses, dashboardUrl } = options;
  const server = new McpServer({
    name: 'resend',
    version: packageJson.version,
  });

  const dashboard = apiKey
    ? new DashboardClient(apiKey, dashboardUrl)
    : undefined;

  addApiKeyTools(server, resend);
  addBroadcastTools(server, resend, {
    senderEmailAddress,
    replierEmailAddresses,
    dashboard,
  });
  addContactPropertyTools(server, resend);
  addContactTools(server, resend);
  addDomainTools(server, resend);
  addEmailTools(server, resend, { senderEmailAddress, replierEmailAddresses });
  addEditorTools(server, dashboard);
  addSegmentTools(server, resend);
  addTopicTools(server, resend);
  addWebhookTools(server, resend);
  return server;
}
