import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Resend } from 'resend';
import { z } from 'zod';
import type { DashboardClient } from '../lib/dashboard-client.js';

export function addTemplateTools(
  server: McpServer,
  resend: Resend,
  {
    dashboard,
    getAgentName,
    withEditorSession,
  }: {
    dashboard?: DashboardClient;
    getAgentName?: () => string | undefined;
    withEditorSession?: <T>(
      conn: {
        resourceType: 'broadcast' | 'template';
        resourceId: string;
        agentName?: string;
      },
      fn: () => Promise<T>,
    ) => Promise<T>;
  },
) {
  server.registerTool(
    'create-template',
    {
      title: 'Create Template',
      description: `**Purpose:** Create a reusable email template. Templates support versioning, variables, and can be published for use via the API.

**NOT for:** Sending a one-off email (use send-email). Not for broadcast campaigns (use create-broadcast).

**Returns:** Template ID.

**When to use:**
- User wants to create a reusable email template
- User says "create a template", "make a template", "new email template"
- Supports TipTap JSON content for visual editing in the dashboard

**Workflow:** get-tiptap-schema (if using content) → create-template → update-template (optional)`,
      inputSchema: {
        name: z
          .string()
          .nonempty()
          .describe(
            'Name for the template. If not provided by the user, create a descriptive name based on the content.',
          ),
        subject: z.string().optional().describe('Email subject line'),
        from: z.string().optional().describe('From email address'),
        html: z
          .string()
          .nonempty()
          .describe('HTML content of the email'),
        text: z
          .string()
          .optional()
          .describe('Plain text content of the email'),
        replyTo: z
          .array(z.string())
          .optional()
          .describe('Reply-to email address(es)'),
        content: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'TipTap JSON content for editable email body. Call get-tiptap-schema first to get the schema reference.',
          ),
      },
    },
    async ({ name, subject, from, html, text, replyTo, content }) => {
      const response = await resend.templates.create({
        name,
        subject,
        from,
        html,
        text,
        replyTo,
      });

      if (response.error) {
        throw new Error(
          `Failed to create template: ${JSON.stringify(response.error)}`,
        );
      }

      // If TipTap content was provided, push it to the Liveblocks room
      if (content && dashboard && withEditorSession) {
        const agentName = getAgentName?.();
        await withEditorSession(
          {
            resourceType: 'template',
            resourceId: response.data.id,
            agentName,
          },
          () =>
            dashboard.updateTemplateContent(response.data.id, {
              content,
              session_name: agentName,
            }),
        );
      }

      return {
        content: [
          { type: 'text', text: 'Template created successfully.' },
          { type: 'text', text: `ID: ${response.data.id}` },
        ],
      };
    },
  );

  server.registerTool(
    'get-template',
    {
      title: 'Get Template',
      description:
        'Retrieve full details of a specific template by ID, including subject, content, and version info.',
      inputSchema: {
        id: z.string().nonempty().describe('Template ID'),
      },
    },
    async ({ id }) => {
      const response = await resend.templates.get(id);

      if (response.error) {
        throw new Error(
          `Failed to get template: ${JSON.stringify(response.error)}`,
        );
      }

      const t = response.data;
      const details = [
        `ID: ${t.id}`,
        `Name: ${t.name}`,
        t.subject && `Subject: ${t.subject}`,
        t.from && `From: ${t.from}`,
        t.reply_to && `Reply-to: ${t.reply_to.join(', ')}`,
        `Status: ${t.status}`,
        `Created at: ${t.created_at}`,
        t.updated_at && `Updated at: ${t.updated_at}`,
      ]
        .filter(Boolean)
        .join('\n');

      let fullDetails = details;
      fullDetails += `\n\n--- Plain Text Content ---\n${t.text || '(none)'}`;
      if (t.html) {
        fullDetails += `\n\n--- HTML Content ---\n${t.html}`;
      }

      return {
        content: [{ type: 'text', text: fullDetails }],
      };
    },
  );

  server.registerTool(
    'list-templates',
    {
      title: 'List Templates',
      description: `**Purpose:** List all email templates with ID, name, status, and timestamps.

**When to use:** User asks "show my templates", "list templates", "what templates do I have?"`,
      inputSchema: {},
    },
    async () => {
      const response = await resend.templates.list();

      if (response.error) {
        throw new Error(
          `Failed to list templates: ${JSON.stringify(response.error)}`,
        );
      }

      const templatesList = response.data.data;

      return {
        content: [
          {
            type: 'text',
            text: `Found ${templatesList.length} template${templatesList.length === 1 ? '' : 's'}${templatesList.length === 0 ? '.' : ':'}`,
          },
          ...templatesList.map((t) => ({
            type: 'text' as const,
            text: [
              `ID: ${t.id}`,
              `Name: ${t.name}`,
              `Status: ${t.status}`,
              `Created at: ${t.created_at}`,
              t.updated_at && `Updated at: ${t.updated_at}`,
            ]
              .filter(Boolean)
              .join('\n'),
          })),
        ],
      };
    },
  );

  server.registerTool(
    'update-template',
    {
      title: 'Update Template',
      description:
        'Update an existing template by ID. Creates a new draft version if the current version is published.',
      inputSchema: {
        id: z.string().nonempty().describe('Template ID'),
        name: z.string().optional().describe('Template name'),
        subject: z.string().optional().describe('Email subject line'),
        from: z.string().optional().describe('From email address'),
        html: z.string().optional().describe('HTML content of the email'),
        text: z
          .string()
          .optional()
          .describe('Plain text content of the email'),
        replyTo: z
          .array(z.string())
          .optional()
          .describe('Reply-to email address(es)'),
        content: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'TipTap JSON content for editable email body. Call get-tiptap-schema first to get the schema reference.',
          ),
      },
    },
    async ({ id, name, subject, from, html, text, replyTo, content }) => {
      const response = await resend.templates.update(id, {
        name,
        subject,
        from,
        html,
        text,
        replyTo,
      });

      if (response.error) {
        throw new Error(
          `Failed to update template: ${JSON.stringify(response.error)}`,
        );
      }

      // If TipTap content was provided, push it to the Liveblocks room
      if (content && dashboard && withEditorSession) {
        const agentName = getAgentName?.();
        await withEditorSession(
          { resourceType: 'template', resourceId: id, agentName },
          () =>
            dashboard.updateTemplateContent(id, {
              content,
              session_name: agentName,
            }),
        );
      }

      return {
        content: [
          { type: 'text', text: 'Template updated successfully.' },
          { type: 'text', text: `ID: ${response.data.id}` },
        ],
      };
    },
  );

  server.registerTool(
    'remove-template',
    {
      title: 'Remove Template',
      description:
        'Remove a template by ID. Before using this tool, you MUST double-check with the user that they want to remove this template. Warn the user that removing a template is irreversible.',
      inputSchema: {
        id: z.string().nonempty().describe('Template ID'),
      },
    },
    async ({ id }) => {
      const response = await resend.templates.remove(id);

      if (response.error) {
        throw new Error(
          `Failed to remove template: ${JSON.stringify(response.error)}`,
        );
      }

      return {
        content: [
          { type: 'text', text: 'Template removed successfully.' },
          { type: 'text', text: `ID: ${response.data.id}` },
        ],
      };
    },
  );
}
