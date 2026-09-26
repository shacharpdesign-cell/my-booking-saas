This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local configuration

Copy `.env.example` to `.env.local` and supply your existing Supabase project's public URL and anonymous key:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not use a service-role key. These values are included in the browser bundle. Configure both variables in Vercel for the intended environments **before** building, and redeploy after changing them. Missing configuration is reported by the application when a connection is attempted.

The owner dashboard at `/panel` validates the current Supabase Auth user and loads the profile with the same ID. Service and appointment queries are scoped to that user ID. Existing Supabase row-level security must independently restrict private owner data to its owner; browser filters are not a security boundary. This repository does not contain the database policies, so production isolation needs verification in Supabase, including with two different owner accounts. Public booking also requires appropriate public profile/service reads, availability reads, and appointment inserts. No database policies or schema are changed by Phase 1.

Verification commands: `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`.
