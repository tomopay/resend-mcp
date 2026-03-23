const DEFAULT_DASHBOARD_URL = 'https://resend.com';
const DEFAULT_API_URL = 'https://api.resend.com';

export class DashboardClient {
  private dashboardUrl: string;
  private apiUrl: string;
  private apiKey: string;

  constructor(
    apiKey: string,
    options?: { dashboardUrl?: string; apiUrl?: string },
  ) {
    this.apiKey = apiKey;
    this.dashboardUrl = (options?.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(
      /\/$/,
      '',
    );
    this.apiUrl = (options?.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
  }

  /**
   * Make a request to the Resend dashboard (Next.js app).
   * Used only for endpoints that live on the dashboard, like the TipTap schema.
   */
  private async dashboardRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.dashboardUrl}/api/agent${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: response.statusText,
      }));
      throw new Error(
        `Dashboard API error (${response.status}): ${error.error || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a request to the Resend public API.
   * Used for editor connect/disconnect and content updates with Liveblocks sync.
   */
  private async apiRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: response.statusText,
      }));
      throw new Error(
        `API error (${response.status}): ${error.message || error.error || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // ── Dashboard endpoints (resend.com) ──────────────────────────────

  async getTiptapSchema(): Promise<{ prompt: string; version: string }> {
    return this.dashboardRequest('GET', '/tiptap-schema');
  }

  // ── Public API endpoints (api.resend.com) ─────────────────────────

  async connectEditor(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ token: string; roomId: string }> {
    return this.apiRequest('POST', '/editor/connect', data);
  }

  async disconnectEditor(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ ok: boolean }> {
    return this.apiRequest('POST', '/editor/disconnect', data);
  }

  /**
   * Update a broadcast with TipTap content via the public API.
   * The public API handles Liveblocks room sync and broadcast events.
   */
  async updateBroadcastContent(
    id: string,
    data: {
      content: Record<string, unknown>;
      session_name?: string;
    },
  ): Promise<{ id: string; object: string }> {
    return this.apiRequest('PATCH', `/broadcasts/${id}`, data);
  }

  /**
   * Update a template with TipTap content via the public API.
   * The public API handles Liveblocks room sync and broadcast events.
   */
  async updateTemplateContent(
    id: string,
    data: {
      content: Record<string, unknown>;
      session_name?: string;
    },
  ): Promise<{ id: string; object: string }> {
    return this.apiRequest('PATCH', `/templates/${id}`, data);
  }
}
