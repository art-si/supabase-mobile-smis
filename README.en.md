<div align="center">

The app uses the shared design system in supabase-mobile-pro. Build it from the main repository’s modules directory, or use MOBILE_PRO_ROOT to locate the matching main repository checkout.
  <h1>Art Supabase SMIS Mobile</h1>
  <p><strong>An H5 and WeChat Mini Program for frontline safety work, connected to Art Supabase Pro</strong></p>
  <p>Risk inspections, hazard reporting, rectification and acceptance, equipment records, and personal shifts in one mobile workspace.</p>

  <p>
    <a href="https://gitee.com/wangyanghub/supabase-mobile-smis">Gitee</a> ·
    <a href="https://gitee.com/wangyanghub/art-supabase-pro">Main Platform</a> ·
    <a href="https://gitee.com/wangyanghub/supabase-mobile-tms-driver">Driver App</a> ·
    <a href="./README.md">简体中文</a>
  </p>
</div>

## Overview

Art Supabase SMIS Mobile is the frontline client for the SMIS safety-management module in `art-supabase-pro`. It is built with uni-app, Vue 3, TypeScript, Pinia, Wot UI v2 (@wot-ui/ui), and Supabase, and targets both H5 and WeChat Mini Programs.

The mobile application does not maintain a separate safety dataset. It shares accounts, employee profiles, organization permissions, dictionaries, and workflow states with the Web application. Secure server-side RPCs provide each employee's authorized tasks and synchronize inspection results, photos, rectification evidence, and acceptance decisions into the same audit trail.

## Capabilities

- Phone or email password login, account-status validation, employee profile, safety metrics, prioritized tasks, and safety messages.
- Risk-inspection and hidden-hazard inspection tasks with filters, item-by-item results, abnormal notes, draft saving, and completion.
- Quick hazard reporting with organization, site, level, exact location, description, recommendation, and field photos.
- Hazard ledger, detail view, lifecycle timeline, rectification evidence, acceptance, and rejection for further work.
- Equipment ledger and details, operating status, inspection reminders, personal shift calendar, and cross-day shifts.

## Local Development

Node.js 22 and pnpm are recommended.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev:h5
```

Configure the public Supabase URL and publishable/anon key in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-publishable-or-anon-key
```

Run checks and production builds with:

```powershell
pnpm dev:mp-weixin
pnpm typecheck
pnpm build:h5
pnpm build:mp-weixin
```

The H5 build writes `docs/` with `.nojekyll`, relative asset URLs, and hash routing so it can run under the repository's subpath. To publish to GitHub Pages, commit the generated `docs/` in this SMIS repository and sync it to GitHub. In the GitHub repository, go to **Settings → Pages**, select **Deploy from a branch → `master` → `/docs`**, and save.

The WeChat Mini Program build is written to `dist/build/mp-weixin/` and still requires the correct AppID, allowed domains, and camera/photo-library permissions.

One-tap phone sign-in is available in the WeChat Mini Program only. Configure the SMIS AppID and WeChat phone authorization, prepare the main repository's `mobile-wechat-auth` service, then set `VITE_ENABLE_WECHAT_PHONE_LOGIN=true` in the build environment. To set it up, sign in with a password and authorize the phone number in the Me page within 10 minutes. If the time expires, sign in with a password again. A number entered only in an employee record does not qualify. Account and password sign-in remains available.

## Security

The client only uses a Supabase `anon` or publishable key and never contains a `service_role` secret. Server-side contracts validate the user, employee, tenant, permission, and workflow state for every business mutation. Dictionaries remain owned by the Web application, while uploaded field photos are governed as auditable business evidence.

## Related Projects

- [`art-supabase-pro`](https://gitee.com/wangyanghub/art-supabase-pro): authentication, tenancy, permissions, dictionaries, and the SMIS Web application.
- [`supabase-mobile-tms-driver`](https://gitee.com/wangyanghub/supabase-mobile-tms-driver): the TMS driver client built with the same mobile stack.
