# Edge Function deployment

The `visualization-lab-api` function has been deployed and is ACTIVE in Supabase project `irnrjzeejalbbqdrbzmj`, version 1, on October 16, 2026. The service handles authenticated bootstrap, save, load, upload URL, submit, instructor list, download, and grade operations. It verifies the Supabase bearer token itself (gateway verify_jwt is false for publishable key compatibility).

The deployed source is managed in Supabase (Dashboard > Edge Functions > visualization-lab-api). To recover the deployed source, use the Supabase dashboard or the Supabase `get_edge_function` API. This delivery contains the static client, SQL schema, and deployment reference, not an offline copy of the deployed function implementation.

Do not redeploy or overwrite the existing student-auth-api, student-portal-api, participation-api, or instructor-api.
