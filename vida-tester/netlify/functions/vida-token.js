// netlify/functions/vida-token.js
//
// Mints a VIDA Bearer Token using OAuth client_credentials and returns it
// along with the Signing Key to the browser. Both come from Netlify env vars
// so they never appear in the deployed HTML/JS.
//
// Env vars required (set in Netlify dashboard, not in this repo):
//   VIDA_CLIENT_ID_SANDBOX
//   VIDA_CLIENT_SECRET_SANDBOX
//   VIDA_SIGNING_KEY_SANDBOX
//   VIDA_CLIENT_ID_PRODUCTION       (optional, only if you also test prod)
//   VIDA_CLIENT_SECRET_PRODUCTION   (optional)
//   VIDA_SIGNING_KEY_PRODUCTION     (optional)

exports.handler = async (event) => {
  const env = (event.queryStringParameters && event.queryStringParameters.environment) || "sandbox";
  const isProd = env === "production";

  // Pick credentials based on environment
  const clientId = isProd
    ? process.env.VIDA_CLIENT_ID_PRODUCTION
    : process.env.VIDA_CLIENT_ID_SANDBOX;
  const clientSecret = isProd
    ? process.env.VIDA_CLIENT_SECRET_PRODUCTION
    : process.env.VIDA_CLIENT_SECRET_SANDBOX;
  const signingKey = isProd
    ? process.env.VIDA_SIGNING_KEY_PRODUCTION
    : process.env.VIDA_SIGNING_KEY_SANDBOX;

  if (!clientId || !clientSecret || !signingKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Missing env vars for environment="${env}". Set VIDA_CLIENT_ID_${env.toUpperCase()}, VIDA_CLIENT_SECRET_${env.toUpperCase()}, VIDA_SIGNING_KEY_${env.toUpperCase()} in Netlify.`,
      }),
    };
  }

  // VIDA SSO endpoints
  // Sandbox: qa-sso.vida.id ; Production: sso.vida.id (per v11 KB)
  const ssoHost = isProd ? "https://sso.vida.id" : "https://qa-sso.vida.id";
  const tokenUrl = `${ssoHost}/auth/realms/vida/protocol/openid-connect/token`;

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: `VIDA OAuth ${resp.status}: ${errText}` }),
      };
    }

    const data = await resp.json();
    const token = data.access_token;

    if (!token) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No access_token in VIDA response", raw: data }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Don't cache — token has a short lifetime (5h sandbox / 5min production)
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        token,
        signingKey,
        environment: env,
        expiresIn: data.expires_in || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
