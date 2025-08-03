# Express Server

This server uses Express with Prisma for database access. Run `npm install` and then `npm run dev` to start the API in watch mode. Use `npm run build` to compile TypeScript to the `dist` folder and `npm start` to run the compiled server.

The database connection string is configured via `.env` and a `docker-compose.yml` file is provided to start a local PostgreSQL instance.

To enable Google authentication set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `ADMIN_EMAILS` in your `.env` file. Emails listed in `ADMIN_EMAILS` (comma separated) will be treated as admins when logging in.

## Google Drive uploads

Invoices are uploaded to Google Drive using a service account. Provide the credentials via the `GOOGLE_DRIVE_API_KEY` environment variable. The variable may contain the raw JSON, a base64-encoded JSON string, or a path to the JSON file. Hosts like Railway don't allow multiline secrets, so base64 is often the simplest approach:

```bash
GOOGLE_DRIVE_API_KEY=$(base64 -w0 service-account.json)
```

At runtime the server automatically detects and parses these formats. If parsing fails the value is used as a plain API key.

## Local HTTPS

The server can also run over HTTPS in development. Generate a self-signed
certificate and point the server to the key and certificate files using the
environment variables `SSL_KEY_PATH` and `SSL_CERT_PATH`.

```bash
# generate certificate valid for your local IP or hostname
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout localhost.key -out localhost.crt -days 365 \
  -subj "/CN=localhost"

# start the server
SSL_KEY_PATH=./localhost.key SSL_CERT_PATH=./localhost.crt npm run dev
```

When these variables are set the server will start an HTTPS listener so you can
access the API from a secure frontend using your local IP and port.
