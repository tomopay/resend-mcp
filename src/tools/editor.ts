import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DashboardClient } from '../lib/dashboard-client.js';

export function addEditorTools(
  server: McpServer,
  dashboard?: DashboardClient,
) {
  server.registerTool(
    'get-tiptap-schema',
    {
      title: 'Get TipTap Email Schema',
      description: `**Purpose:** Retrieve the TipTap JSON schema reference for creating editable email content that works in the Resend dashboard editor.

**When to use:**
- Before using create-broadcast or update-broadcast with the \`content\` parameter
- When you need to understand the available TipTap node types and structure

**Returns:** A prompt describing the full TipTap JSON schema, including all node types, marks, and attributes.`,
      inputSchema: {},
    },
    async () => {
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key to enable TipTap schema access.',
        );
      }

      const { prompt, version } = await dashboard.getTiptapSchema();

      return {
        content: [
          {
            type: 'text',
            text: `TipTap Schema Reference (version: ${version}):\n\n${prompt}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'connect-to-editor',
    {
      title: 'Connect to Editor',
      description: `**Purpose:** Show agent presence in the Resend dashboard editor. Users will see an agent avatar while connected.

**When to use:**
- Before making edits to a broadcast or template via the dashboard API
- To signal to dashboard users that an AI agent is working on the content

**Returns:** Connection token and room ID.`,
      inputSchema: {
        resourceType: z
          .enum(['broadcast', 'template'])
          .describe('Type of resource to connect to'),
        resourceId: z.string().nonempty().describe('ID of the resource'),
        agentName: z
          .string()
          .optional()
          .describe('Display name for the agent avatar'),
      },
    },
    async ({ resourceType, resourceId, agentName }) => {
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key.',
        );
      }

      const result = await dashboard.connectEditor({
        resourceType,
        resourceId,
        agentName,
      });

      return {
        content: [
          { type: 'text', text: 'Connected to editor successfully.' },
          { type: 'text', text: `Room ID: ${result.roomId}` },
        ],
      };
    },
  );

  server.registerTool(
    'disconnect-from-editor',
    {
      title: 'Disconnect from Editor',
      description:
        'Remove agent presence from the Resend dashboard editor. Call this when done editing.',
      inputSchema: {},
    },
    async () => {
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key.',
        );
      }

      await dashboard.disconnectEditor();

      return {
        content: [
          { type: 'text', text: 'Disconnected from editor successfully.' },
        ],
      };
    },
  );
}
