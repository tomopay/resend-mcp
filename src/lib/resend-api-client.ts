const DEFAULT_API_URL = 'https://api.resend.com';

export class ResendApiClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiKey: string, options?: { apiUrl?: string }) {
    this.apiKey = apiKey;
    this.apiUrl = (options?.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
  }

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

  async createEditorConnection(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ token: string; roomId: string }> {
    return this.apiRequest('POST', '/editor/connections', data);
  }

  async deleteEditorConnection(data: {
    resourceType: 'broadcast' | 'template';
    resourceId: string;
    agentName?: string;
  }): Promise<{ ok: boolean }> {
    return this.apiRequest('DELETE', '/editor/connections', data);
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
