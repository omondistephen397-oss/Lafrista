# Lafrista Fashion & Design

Lafrista is a responsive clothing studio website hosted with GitHub Pages. Supabase provides private shared inventory, a realtime product catalog, and a customer enquiry inbox. The public storefront stays readable when Supabase has not been configured; its enquiry form then opens a prefilled email draft.

## Set up the live backend

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) once. It creates the tables, row-level security policies, stock movement functions, and realtime publication.
3. In Supabase Authentication, create an owner account and disable public sign-ups. Only accounts explicitly listed in `studio_admins` can use the dashboard.
4. Copy the new user's UUID from Authentication and add it using the SQL Editor:

   ```sql
   insert into public.studio_admins (user_id)
   values ('AUTH-USER-UUID');
   ```

5. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `SUPABASE_URL`: the project URL.
   - `SUPABASE_PUBLIC_KEY`: the project's publishable key (or legacy anon/public key).

   Never use a Supabase secret or service-role key in the website or GitHub Pages. The public key is safe to expose only because the schema enforces row-level security.
6. Merge the changes to `main` or run the **Publish Lafrista website** workflow. It publishes the storefront and the sign-in-protected dashboard at <https://omondistephen397-oss.github.io/Lafrista/dashboard.html>.

The public website is <https://omondistephen397-oss.github.io/Lafrista/>. Products added in the dashboard are public and appear on the storefront immediately. Inventory and customer enquiries are private to authorized studio admins. Public enquiries are stored in Supabase and appear in the dashboard in realtime; this setup does not send email notifications.

## Run locally

Serve the repository over HTTP (ES modules do not work from a `file://` URL). For example, with Python:

```powershell
python -m http.server 8000
```

Copy `supabase-config.example.js` to `supabase-config.js`, set the project URL and public key, then open `http://localhost:8000/`. The local config file is git-ignored.

## Security notes

The dashboard is a public static page, but its data and actions require an authenticated studio admin. RLS prevents public visitors from reading inventory or enquiries, and stock changes use database functions that validate quantities atomically. Do not enable public account registration or add untrusted users to `studio_admins`. Customer messages are personal data; limit admin accounts to trusted staff. Consider enabling a CAPTCHA/anti-spam service before promoting the public enquiry form.

## Design system

The shared visual foundations live at the top of `styles.css` in `:root`: color, typography, spacing, and content-width tokens. The header and footer pair the Lafrista wordmark with an FSA monogram for Fridah, Stephen, and Andy. Reusable patterns include the announcement bar, navigation, buttons, text links, service cards, section headings, form controls, and responsive page layouts.
