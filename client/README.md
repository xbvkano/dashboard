# React Dashboard

This project was bootstrapped with [Vite](https://vitejs.dev/) and includes `tailwindcss` and `react-router-dom`. All code is written in **TypeScript**.

## Available Scripts

- `npm install` – install dependencies
- `npm run dev` – start the development server
- `npm run dev -- --ngrok` – start dev server; sends `ngrok-skip-browser-warning` on API requests (also auto-detected on ngrok hostnames)
- `npm run dev -- --no-auth` – skip Google login; auto POST `/login` as seeded owner (`7025550199` / `SeedAdmin!99`)
- **Phone testing:** run API on `:3000`, then `npm run dev -- --ngrok --no-auth` on `:5173`, then `ngrok http 5173`. API calls use `/api` proxied to localhost. **Both** server `NO_AUTH=1` and client `--no-auth` (or `VITE_NO_AUTH=true`) are required.

The app starts with a login page where you can sign in with Google. To enable Google sign-in provide `VITE_GOOGLE_CLIENT_ID` in an `.env` file. API requests are sent to `VITE_API_BASE_URL`, which defaults to `http://localhost:3000`.
