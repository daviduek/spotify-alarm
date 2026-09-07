# supabase/

SQL migrations for the Wake web app. Apply with the Supabase MCP (`apply_migration`) or the CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Auth settings to review in the dashboard (not expressible in SQL):
- Authentication → URL Configuration → Site URL = your Vercel URL; add `https://<vercel-domain>/auth/callback` to Redirect URLs.
- Authentication → Providers → Email: keep "Confirm email" on for production; turn it off while testing to log in instantly.
