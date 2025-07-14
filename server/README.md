# Express Server

This server uses Express with Prisma for database access. Run `npm install` and then `npm run dev` to start the API in watch mode. Use `npm run build` to compile TypeScript to the `dist` folder and `npm start` to run the compiled server.

The database connection string is configured via `.env` and a `docker-compose.yml` file is provided to start a local PostgreSQL instance.

To enable Google authentication set `GOOGLE_CLIENT_ID` and `ADMIN_EMAILS` in your `.env` file. Emails listed in `ADMIN_EMAILS` (comma separated) will be treated as admins when logging in.
