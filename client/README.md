# React Dashboard

This project was bootstrapped with [Vite](https://vitejs.dev/) and includes `tailwindcss` and `react-router-dom`. All code is written in **TypeScript**.

## Available Scripts

- `npm install` – install dependencies
- `npm run dev` – start the development server
- `npm run dev -ngrok` – start dev server and add the `ngrok-skip-browser-warning` header to all API requests

The app starts with a login page where you can sign in with Google. To enable Google sign-in provide `VITE_GOOGLE_CLIENT_ID` in an `.env` file. API requests are sent to `VITE_API_BASE_URL`, which defaults to `http://localhost:3000`.
