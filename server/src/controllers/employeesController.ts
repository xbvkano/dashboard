import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normalizePhone } from '../utils/phoneUtils'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// Generate userName from phone number (remove +1 and formatting)
function generateUserName(phoneNumber: string): string {
  // Remove all non-digit characters, then remove leading 1 if present
  const digits = phoneNumber.replace(/\D/g, '')
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
}

export async function getEmployees(req: Request, res: Response) {
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)
  const includeDisabled = String(req.query.all) === 'true'

  const where: any = searchTerm
    ? {
        ...(includeDisabled ? {} : { disabled: false }),
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { number: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }
    : includeDisabled ? {} : { disabled: false }

  try {
    const employees = await prisma.employee.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    })
    res.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const { name, number, notes, experienced, disabled, password } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
      disabled?: boolean
      password?: string
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }
    const normalized = normalizePhone(number)
    if (!normalized) {
      return res.status(400).json({ error: 'Number must be 10 or 11 digits' })
    }
    const userName = generateUserName(normalized)
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Upsert user and create employee
    const user = await prisma.user.upsert({
      where: { userName },
      update: {
        name,
        password: hashedPassword,
        type: 'password',
        userName,
      },
      create: {
        name,
        password: hashedPassword,
        type: 'password',
        userName,
        role: 'EMPLOYEE',
      },
    })
    
    const employee = await prisma.employee.create({
      data: {
        name,
        number: normalized,
        notes,
        experienced: experienced ?? false,
        disabled: disabled ?? false,
        userId: user.id,
      },
    })
    res.json(employee)
  } catch (e: any) {
    console.error('Error creating employee:', e)
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'Employee with this phone number already exists' })
    }
    res.status(500).json({ error: 'Failed to create employee' })
  }
}

export async function getEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const employee = await prisma.employee.findUnique({ 
    where: { id },
    include: { user: true }
  })
  if (!employee) return res.status(404).json({ error: 'Not found' })
  // Don't send password hash to client
  const { user, ...employeeData } = employee
  const response: any = employeeData
  if (user) {
    response.hasPassword = !!user.password
    response.userType = user.type
  }
  res.json(response)
}

export async function updateEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, notes, experienced, disabled, password } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
      disabled?: boolean
      password?: string
    }
    
    // Get existing employee to check for user
    const existingEmployee = await prisma.employee.findUnique({ 
      where: { id },
      include: { user: true }
    })
    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' })
    }
    
    const data: any = {}
    if (name !== undefined) data.name = name
    if (number !== undefined) {
      const normalized = normalizePhone(number)
      if (!normalized) {
        return res.status(400).json({ error: 'Number must be 10 or 11 digits' })
      }
      data.number = normalized
    }
    if (notes !== undefined) data.notes = notes
    if (experienced !== undefined) data.experienced = experienced
    if (disabled !== undefined) data.disabled = disabled
    
    const employee = await prisma.employee.update({ where: { id }, data })
    
    // Update or create user
    const userName = generateUserName(employee.number)
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      
      const userData: any = {
        name: employee.name,
        password: hashedPassword,
        type: 'password',
        userName,
        role: 'EMPLOYEE',
      }
      
      // Upsert user by userName
      const user = await prisma.user.upsert({
        where: { userName },
        update: userData,
        create: userData,
      })
      
      // Link employee to user if not already linked or if user changed
      if (existingEmployee.userId !== user.id) {
        await prisma.employee.update({
          where: { id },
          data: { userId: user.id },
        })
      }
    } else if (existingEmployee.userId) {
      // Update user name if employee name changed
      const updateData: any = {}
      if (name !== undefined) updateData.name = employee.name
      
      // Check if userName needs to be updated (phone number changed)
      const existingUser = await prisma.user.findUnique({ where: { id: existingEmployee.userId } })
      if (existingUser && existingUser.userName !== userName) {
        // Phone number changed - check for conflict
        const conflictingUser = await prisma.user.findUnique({ where: { userName } })
        if (conflictingUser && conflictingUser.id !== existingEmployee.userId) {
          return res.status(400).json({ error: 'Another user already exists with this phone number' })
        }
        updateData.userName = userName
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: existingEmployee.userId },
          data: updateData,
        })
      }
    }
    
    res.json(employee)
  } catch (e: any) {
    console.error('Error updating employee:', e)
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'User with this phone number already exists' })
    }
    res.status(500).json({ error: 'Failed to update employee' })
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    await prisma.employee.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete employee' })
  }
}

export async function getEmployeeAppointments(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '25'), 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        employees: { some: { id } },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      skip,
      take,
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    res.json(appts)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}
