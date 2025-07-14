import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'

dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean)

app.use(cors())
app.use(express.json())

app.get('/', async (_req: Request, res: Response) => {
  res.json({ message: 'Hello from server' })
})

app.get('/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

app.post('/login', async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) {
    return res.status(400).json({ error: 'Missing token' })
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: { name: payload.name || undefined },
      create: { email: payload.email, name: payload.name || undefined }
    })

    const role = adminEmails.includes(payload.email) ? 'admin' : 'user'
    res.json({ role, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
