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

/**
 * Map appointment time to schedule slot: AM = before 2pm (slot 'A'), PM = 2pm or after (slot 'M').
 * Schedule entry format: YYYY-MM-DD-T-S (e.g. 2026-01-30-A-F).
 */
// Schedule uses M = Morning (AM), A = Afternoon (PM). AM = before 2pm, PM = 2pm or after.
function getSlotFromTime(timeStr: string): 'M' | 'A' {
  if (!timeStr || typeof timeStr !== 'string') return 'M'
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10))
  const minutes = (h ?? 0) * 60 + (m ?? 0)
  return minutes < 14 * 60 ? 'M' : 'A' // before 2pm = M (AM), 2pm+ = A (PM)
}

export async function getAvailableEmployees(req: Request, res: Response) {
  const dateStr = String(req.query.date || '')
  const timeStr = String(req.query.time || '')
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'date required (YYYY-MM-DD)' })
  }
  const slot = timeStr ? getSlotFromTime(timeStr) : null
  try {
    const employees = await prisma.employee.findMany({
      where: { disabled: false },
      include: { schedule: true },
      orderBy: { name: 'asc' },
    })
    const result = employees.map((emp) => {
      const future = emp.schedule?.futureSchedule ?? []
      const hasAvailability = future.some((entry) => {
        const parts = entry.split('-')
        if (parts.length !== 5) return false
        const [y, m, d, t, status] = parts
        const entryDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        if (entryDate !== dateStr || status !== 'F') return false
        if (slot != null && t !== slot) return false
        return true
      })
      return { ...emp, available: hasAvailability }
    })
    res.json(result)
  } catch (error) {
    console.error('Error fetching available employees:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const { name, number, notes, disabled, password, supervisorId: rawSupervisorId } = req.body as {
      name?: string
      number?: string
      notes?: string
      disabled?: boolean
      password?: string
      supervisorId?: number | string
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }
    const supervisorId = rawSupervisorId === '' || rawSupervisorId == null ? null : Number(rawSupervisorId)
    if (supervisorId == null || Number.isNaN(supervisorId)) {
      return res.status(400).json({ error: 'Assigned supervisor is required' })
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
    
    // Validate supervisor is OWNER or SUPERVISOR
    const supervisorUser = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { role: true },
    })
    if (!supervisorUser || !['OWNER', 'SUPERVISOR'].includes(supervisorUser.role)) {
      return res.status(400).json({ error: 'Invalid supervisor' })
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        number: normalized,
        notes,
        disabled: disabled ?? false,
        userId: user.id,
        supervisorId,
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

/** List users who can be assigned as supervisors (OWNER and SUPERVISOR only) */
export async function getSupervisors(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['OWNER', 'SUPERVISOR'] } },
      select: { id: true, name: true, userName: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    res.json(users)
  } catch (e) {
    console.error('Error fetching supervisors:', e)
    res.status(500).json({ error: 'Failed to fetch supervisors' })
  }
}

export async function getEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { user: true, supervisor: { select: { id: true, name: true } } },
  })
  if (!employee) return res.status(404).json({ error: 'Not found' })
  // Don't send password hash to client
  const { user, supervisor, ...employeeData } = employee
  const response: any = { ...employeeData, supervisorId: employee.supervisorId ?? null }
  if (user) {
    response.hasPassword = !!user.password
    response.userType = user.type
  }
  if (supervisor) {
    response.supervisor = supervisor
  }
  res.json(response)
}

export async function updateEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, notes, disabled, password, supervisorId: rawSupervisorId } = req.body as {
      name?: string
      number?: string
      notes?: string
      disabled?: boolean
      password?: string
      supervisorId?: number | string | null
    }

    // Get existing employee to check for user
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const newSupervisorId =
      rawSupervisorId !== undefined
        ? (rawSupervisorId === '' || rawSupervisorId == null ? null : Number(rawSupervisorId))
        : undefined
    if (newSupervisorId !== undefined && (newSupervisorId === null || Number.isNaN(newSupervisorId))) {
      return res.status(400).json({ error: 'Assigned supervisor is required' })
    }
    if (newSupervisorId != null && !Number.isNaN(newSupervisorId)) {
      const supervisorUser = await prisma.user.findUnique({
        where: { id: newSupervisorId },
        select: { role: true },
      })
      if (!supervisorUser || !['OWNER', 'SUPERVISOR'].includes(supervisorUser.role)) {
        return res.status(400).json({ error: 'Invalid supervisor' })
      }
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
    if (disabled !== undefined) data.disabled = disabled
    if (newSupervisorId !== undefined) data.supervisorId = newSupervisorId

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
