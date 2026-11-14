const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const API_URL = "https://opensky-network.org/api/states/all";

export class OpenSkyClient {
  constructor({ clientId, clientSecret, bounds }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.bounds = bounds;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  get authenticated() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getAccessToken() {
    if (!this.authenticated) return null;

    // Refresh 60 seconds before expiry.
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenSky OAuth failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + (Number(data.expires_in) || 1800) * 1000;
    return this.token;
  }

  async getStates() {
    const url = new URL(API_URL);
    const { lamin, lamax, lomin, lomax } = this.bounds;
    url.searchParams.set("lamin", String(lamin));
    url.searchParams.set("lamax", String(lamax));
    url.searchParams.set("lomin", String(lomin));
    url.searchParams.set("lomax", String(lomax));

    const headers = {};
    const token = await this.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });

    // One immediate token refresh/retry on expired credentials.
    if (response.status === 401 && this.authenticated) {
      this.token = null;
      const refreshedToken = await this.getAccessToken();
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${refreshedToken}` },
        signal: AbortSignal.timeout(20_000)
      });
    }

    if (!response.ok) {
      const error = new Error(`OpenSky request failed: HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfterSeconds = Number(response.headers.get("x-rate-limit-retry-after-seconds")) || null;
      error.detail = (await response.text()).slice(0, 300);
      throw error;
    }

    return response.json();
  }
}
