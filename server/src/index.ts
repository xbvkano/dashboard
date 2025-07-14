import express from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000

app.get('/', async (_req, res) => {
  res.json({ message: 'Hello from server' })
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
