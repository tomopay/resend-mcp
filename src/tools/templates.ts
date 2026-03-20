import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DashboardClient } from '../lib/dashboard-client.js';

export function addTemplateTools(
  server: McpServer,
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

**Returns:** Template ID and version ID.

**When to use:**
- User wants to create a reusable email template
- User says "create a template", "make a template", "new email template"
- Supports TipTap JSON content for visual editing in the dashboard

**Workflow:** get-tiptap-schema (if using content) → create-template → update-template (optional) → publish-template`,
      inputSchema: {
        name: z
          .string()
          .nonempty()
          .describe(
            'Name for the template. If not provided by the user, create a descriptive name based on the content.',
          ),
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
        previewText: z
          .string()
          .optional()
          .describe('Preview text for the email'),
        content: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'TipTap JSON content for editable email body. Call get-tiptap-schema first to get the schema reference.',
          ),
      },
    },
    async ({ name, subject, from, html, text, replyTo, previewText, content }) => {
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key to enable template management.',
        );
      }

      const result = await dashboard.createTemplate({
        name,
        content,
        subject,
        from,
        html,
        text,
        reply_to: replyTo,
        preview_text: previewText,
      });

      if (content && withEditorSession) {
        const agentName = getAgentName?.();
        await withEditorSession(
          { resourceType: 'template', resourceId: result.id, agentName },
          () =>
            dashboard.updateTemplate(result.id, {
              content,
              session_name: agentName,
            }),
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Template created successfully.',
          },
          { type: 'text', text: `ID: ${result.id}` },
          { type: 'text', text: `Version ID: ${result.version_id}` },
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
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key.',
        );
      }

      const template = await dashboard.getTemplate(id);

      const details = [
        `ID: ${template.id}`,
        `Name: ${template.name}`,
        template.version_id && `Version ID: ${template.version_id}`,
        template.subject && `Subject: ${template.subject}`,
        template.from && `From: ${template.from}`,
        template.reply_to && `Reply-to: ${(template.reply_to as string[]).join(', ')}`,
        template.preview_text && `Preview text: ${template.preview_text}`,
        `Status: ${template.status}`,
        `Created at: ${template.created_at}`,
        template.updated_at && `Updated at: ${template.updated_at}`,
        template.published_at && `Published at: ${template.published_at}`,
      ]
        .filter(Boolean)
        .join('\n');

      let fullDetails = details;
      fullDetails += `\n\n--- Plain Text Content ---\n${(template.text as string) || '(none)'}`;
      if (template.html) {
        fullDetails += `\n\n--- HTML Content ---\n${template.html}`;
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
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key.',
        );
      }

      const response = await dashboard.listTemplates();
      const templatesList = response.data;

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
        previewText: z
          .string()
          .optional()
          .describe('Preview text for the email'),
        content: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'TipTap JSON content for editable email body. Call get-tiptap-schema first to get the schema reference.',
          ),
      },
    },
    async ({
      id,
      name,
      subject,
      from,
      html,
      text,
      replyTo,
      previewText,
      content,
    }) => {
      if (!dashboard) {
        throw new Error(
          'Dashboard integration not configured. Provide a Resend API key.',
        );
      }

      const agentName = getAgentName?.();

      const doUpdate = () =>
        dashboard.updateTemplate(id, {
          name,
          content,
          subject,
          from,
          html,
          text,
          reply_to: replyTo,
          preview_text: previewText,
          session_name: agentName,
        });

      const result =
        content && withEditorSession
          ? await withEditorSession(
              { resourceType: 'template', resourceId: id, agentName },
              doUpdate,
            )
          : await doUpdate();

      return {
        content: [
          { type: 'text', text: 'Template updated successfully.' },
          { type: 'text', text: `ID: ${result.id}` },
          { type: 'text', text: `Version ID: ${result.version_id}` },
        ],
      };
    },
  );
}
