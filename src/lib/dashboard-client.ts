const DEFAULT_DASHBOARD_URL = 'https://resend.com';

export class DashboardClient {
  private dashboardUrl: string;

  constructor(options?: { dashboardUrl?: string }) {
    this.dashboardUrl = (
      options?.dashboardUrl || DEFAULT_DASHBOARD_URL
    ).replace(/\/$/, '');
  }

  async getTiptapSchema(): Promise<{ prompt: string; version: string }> {
    const url = `${this.dashboardUrl}/static/tiptap-schema.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch TipTap schema (${response.status}): ${response.statusText}`,
      );
    }
    return response.json() as Promise<{ prompt: string; version: string }>;
  }
}
