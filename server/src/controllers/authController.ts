import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'
import axios from 'axios'

const prisma = new PrismaClient()

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173'
)

export async function login(req: Request, res: Response) {
  const { token, code } = req.body as { token?: string; code?: string }
  if (!token && !code) {
    return res.status(400).json({ error: 'Missing token or code' })
  }
  try {
    let email: string | undefined
    let name: string | undefined

    if (code) {
      const { tokens } = await client.getToken({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173',
      })
      if (tokens.id_token) {
        const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        email = payload?.email
        name = payload?.name || undefined
      } else if (tokens.access_token) {
        const resp = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        email = resp.data.email
        name = resp.data.name
      }
    } else if (token) {
      if (token.includes('.')) {
        const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        email = payload?.email
        name = payload?.name || undefined
      } else {
        const resp = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        email = resp.data.email
        name = resp.data.name
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name || undefined },
      create: { email, name: name || undefined, role: 'EMPLOYEE' },
    })

    res.json({ role: user.role, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

export async function getUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany()
  res.json(users)
}

export async function getAdmins(_req: Request, res: Response) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    orderBy: { name: 'asc' },
  })
  res.json(admins)
}
