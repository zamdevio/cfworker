# Auth System

## How a profile name resolves

1. `env` reads `CLOUDFLARE_API_TOKEN`, then `CF_API_TOKEN`, then `CFWORKER_TOKEN`.
2. Any other name reads `~/.config/cfworker/<name>.toml`.
3. Then Wrangler v4: `~/.config/.wrangler/config/<name>.toml`.
4. Then Wrangler v3: `~/.wrangler/config/<name>.toml`.

An environment token does not replace a named profile that has a file. `WRANGLER_CONFIG_DIR` replaces the Wrangler directories. Separate several with the platform path delimiter. `CFWORKER_CONFIG_DIR` replaces the cfworker directory.

Wrangler OAuth access tokens expire. When `expiration_time` is missing, past, or within a minute, cfworker exchanges `refresh_token` at `https://dash.cloudflare.com/oauth2/token` with Wrangler's client id and writes the new tokens back to that profile file. A rejected access token gets one refresh and a retry. `WRANGLER_CLIENT_ID`, `WRANGLER_TOKEN_URL`, and `WRANGLER_AUTH_DOMAIN` override that request.

`profiles` lists each name once, with the source that would actually be read. `env` is included when a token is set. The name `env` cannot be used for a saved profile.

## Profile vs account

- **Profile**: token holder. Name comes from a toml file, or `env`.
- **Account**: Cloudflare account returned by the API for that token.

## Commands

- `cfworker login` checks the token with `GET /user`, then writes `~/.config/cfworker/<profile>.toml` at mode `0600`.
- `cfworker profiles` lists name, source, and file.
- `cfworker accounts` lists accounts for the selected profile.

## Token files

Quoted `oauth_token`, `token`, `api_token`, or `cloudflare_api_token`. A bare value is accepted for the last three.
