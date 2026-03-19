const DEFAULT_DASHBOARD_URL = 'https://resend.com';

export class DashboardClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, dashboardUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/agent${path}`;
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

  async getTiptapSchema(): Promise<{ prompt: string; version: string }> {
    return this.request('GET', '/tiptap-schema');
  }

  async createBroadcast(data: {
    name: string;
    content?: Record<string, unknown>;
    subject?: string;
    from?: string;
    html?: string;
    text?: string;
    reply_to?: string[];
    preview_text?: string;
    audience_id?: string;
    topic_id?: string;
  }): Promise<{ id: string; created_at: string; status: string }> {
    return this.request('POST', '/broadcasts', data);
  }

  async updateBroadcast(
    id: string,
    data: {
      name?: string;
      content?: Record<string, unknown>;
      subject?: string;
      from?: string;
      html?: string;
      text?: string;
      reply_to?: string[];
      preview_text?: string;
      audience_id?: string | null;
      topic_id?: string | null;
      session_name?: string;
    },
  ): Promise<{ id: string; status: string; updated_at: string }> {
    return this.request('PATCH', `/broadcasts/${id}`, data);
  }

  async getBroadcast(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/broadcasts/${id}`);
  }

  async connectEditor(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ token: string; roomId: string }> {
    return this.request('POST', '/editor/connect', data);
  }

  async disconnectEditor(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ ok: boolean }> {
    return this.request('POST', '/editor/disconnect', data);
  }
}
