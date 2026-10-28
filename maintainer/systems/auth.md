# Auth System

## Sources (priority)
1. Environment variables: `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CFWORKER_TOKEN`
2. Built-in cfworker profiles: `~/.config/cfworker/*.toml`
3. Wrangler profiles: `~/.config/.wrangler/config/*.toml` (v4), `~/.wrangler/config/*.toml` (v3)

## Profile vs Account
- **Profile**: Auth session (token holder). Identified by name from config files.
- **Account**: Cloudflare account/org. Fetched via API using profile token.

## Commands
- `cfworker login` - save token to `~/.config/cfworker/<profile>.toml`
- `cfworker profiles` - list available profiles from all sources
- `cfworker accounts` - list accounts for a profile
