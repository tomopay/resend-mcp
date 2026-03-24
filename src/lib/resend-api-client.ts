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
   * Compose a broadcast from TipTap content via the public API.
   * The API generates HTML/text from the TipTap JSON, saves content, and
   * syncs changes to Liveblocks for real-time collaboration.
   */
  async composeBroadcastContent(
    id: string,
    data: {
      content: Record<string, unknown>;
      preview_text?: string;
      session_name?: string;
    },
  ): Promise<{ id: string; object: string }> {
    return this.apiRequest('POST', `/broadcasts/${id}/compose`, data);
  }

  /**
   * Compose a template from TipTap content via the public API.
   * The API generates HTML/text from the TipTap JSON, saves content, and
   * syncs changes to Liveblocks for real-time collaboration.
   */
  async composeTemplateContent(
    id: string,
    data: {
      content: Record<string, unknown>;
      preview_text?: string;
      session_name?: string;
    },
  ): Promise<{ id: string; object: string }> {
    return this.apiRequest('POST', `/templates/${id}/compose`, data);
  }
}
