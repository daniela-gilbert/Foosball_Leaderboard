# Cadet Lounge Foosball Leaderboard

A shared, phone-friendly foosball leaderboard connected to your Supabase project.

## 1. Create the database

1. Open your Supabase project.
2. Open **SQL Editor** and choose **New query**.
3. Copy all of `supabase-setup.sql` into the editor and click **Run**.

The script creates `players` and `games`, enables live updates, and applies Row Level Security. Visitors may read standings, add players, and record matches. They cannot edit or delete records.

## 2. Test locally

Open `index.html` in a browser. If your browser blocks local-file requests, serve the folder with any static web server, for example:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## 3. Put it online

Upload the contents of this folder to any static host, such as Netlify, Cloudflare Pages, GitHub Pages, or Vercel. No build command or server is required.

For Netlify, you can drag this entire folder into the deployment area at https://app.netlify.com/drop and receive a public URL.

## Scoring and ranking

- Win: 3 points
- Loss: 0 points
- Tiebreakers: win percentage, then wins, then player name
- Standings and match history update live on every open device

## Correcting a mistake

Public users cannot alter history. In Supabase, open **Table Editor → games**, find the incorrect match, and delete it. All connected leaderboards will update after refresh (or the next live event).

## Security note

The publishable key in `app.js` is intended for browser use. Access is limited by the SQL Row Level Security policies. Never place a Supabase secret key or service-role key in these files.
