import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { parseSqft, calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'
import twilio from 'twilio'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

async function syncPayrollItems(apptId: number, employeeIds: number[]) {
  const existing = await prisma.payrollItem.findMany({ where: { appointmentId: apptId } })
  const existingIds = existing.map((p: { employeeId: number }) => p.employeeId)
  const toAdd = employeeIds.filter((id) => !existingIds.includes(id))
  const toRemove = existing.filter((p: { employeeId: number }) => !employeeIds.includes(p.employeeId))
  if (toAdd.length) {
    await prisma.payrollItem.createMany({ data: toAdd.map((id: number) => ({ appointmentId: apptId, employeeId: id })) })
  }
  if (toRemove.length) {
    await prisma.payrollItem.deleteMany({ where: { id: { in: toRemove.map((p: { id: number }) => p.id) } } })
  }
}

async function ensureRecurringFuture() {
  return
}

export async function getAppointments(req: Request, res: Response) {
  await ensureRecurringFuture()
  const dateStr = String(req.query.date || '')
  if (!dateStr) return res.status(400).json({ error: 'date required' })
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'invalid date' })
  }
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: date, lt: next },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      orderBy: { time: 'asc' },
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

export async function getAppointmentsByLineage(req: Request, res: Response) {
  const { lineage } = req.params
  try {
    const appts = await prisma.appointment.findMany({
      where: { lineage },
      orderBy: { date: 'asc' },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    res.json(appts)
  } catch {
    res.status(500).json({ error: 'Failed to fetch lineage appointments' })
  }
}

export async function getNoTeamAppointments(_req: Request, res: Response) {
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        noTeam: true,
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    res.json(appts)
  } catch (err) {
    console.error('Failed to fetch no-team appointments:', err)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

export async function getUpcomingRecurringAppointments(_req: Request, res: Response) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next = new Date(today)
    next.setDate(next.getDate() + 7)
    const appts = await prisma.appointment.findMany({
      where: {
        reoccurring: true,
        reocuringDate: { gte: today, lte: next },
        status: { notIn: ['DELETED', 'CANCEL'] },
      },
      orderBy: { reocuringDate: 'asc' },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    const results = appts.map((a: any) => ({
      ...a,
      daysLeft: Math.ceil((a.reocuringDate!.getTime() - today.getTime()) / 86400000),
    }))
    res.json(results)
  } catch (err) {
    console.error('Failed to fetch upcoming recurring appointments:', err)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

export async function updateRecurringDone(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  const done = !!(req.body as any).done
  try {
    const appt = await prisma.appointment.update({
      where: { id },
      data: { recurringDone: done },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    res.json(appt)
  } catch (err) {
    console.error('Failed to update recurringDone:', err)
    res.status(500).json({ error: 'Failed to update appointment' })
  }
}

export async function createRecurringAppointment(req: Request, res: Response) {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      carpetPrice,
      carpetEmployees = [],
      count = 1,
      frequency,
      noTeam = false,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      count?: number
      frequency?: string
      noTeam?: boolean
    }

    if (!clientId || !templateId || !date || !time || !adminId || !frequency) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return res.status(400).json({ error: 'Invalid templateId' })
    }

    const crypto = require('crypto')
    const lineage = crypto.randomUUID()
    const first = new Date(date)
    const nextDate = new Date(first)
    if (frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7)
    else if (frequency === 'BIWEEKLY') nextDate.setDate(nextDate.getDate() + 14)
    else if (frequency === 'EVERY3') nextDate.setDate(nextDate.getDate() + 21)
    else if (frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1)
    else {
      const m = parseInt(String(req.body.months || 1), 10)
      nextDate.setMonth(nextDate.getMonth() + (isNaN(m) ? 1 : m))
    }
    const carpetRoomsFinal =
      carpetRooms !== undefined ? carpetRooms : template.carpetRooms ?? null
    let finalCarpetPrice = carpetPrice
    if (finalCarpetPrice === undefined) {
      if (template.carpetPrice != null && carpetRoomsFinal) {
        finalCarpetPrice = template.carpetPrice
      } else if (carpetRoomsFinal && template.size) {
        const sqft = parseSqft(template.size)
        if (sqft !== null) {
          finalCarpetPrice = carpetRoomsFinal * (sqft >= 4000 ? 40 : 35)
        }
      }
    }
    const appt = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        date: first,
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees,
        paymentMethod: paymentMethod as any,
        notes:
          [template.notes, paymentMethodNote].filter(Boolean).join(' | ') ||
          undefined,
        status: 'REOCCURRING',
        lineage,
        reoccurring: true,
        reocuringDate: nextDate,
        ...(employeeIds.length > 0 && {
          employees: {
            connect: employeeIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    if (!noTeam && employeeIds.length) {
      await syncPayrollItems(appt.id, employeeIds)
    }

    res.json(appt)
  } catch (err) {
    console.error('Error creating recurring appointments:', err)
    res.status(500).json({ error: 'Failed to create recurring appointments' })
  }
}

export async function createAppointment(req: Request, res: Response) {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      carpetPrice,
      carpetEmployees = [],
      status = 'APPOINTED',
      observation,
      noTeam = false,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      status?: string
      observation?: string
      noTeam?: boolean
    }

    // required-field guard
    if (!clientId || !templateId || !date || !time || !adminId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return res.status(400).json({ error: 'Invalid templateId' })
    }

    const carpetRoomsFinal =
      carpetRooms !== undefined ? carpetRooms : template.carpetRooms ?? null
    let finalCarpetPrice = carpetPrice
    if (finalCarpetPrice === undefined) {
      if (template.carpetPrice != null && carpetRoomsFinal) {
        finalCarpetPrice = template.carpetPrice
      } else if (carpetRoomsFinal && template.size) {
        const sqft = parseSqft(template.size)
        if (sqft !== null) {
          finalCarpetPrice = carpetRoomsFinal * (sqft >= 4000 ? 40 : 35)
        }
      }
    }

    const appt = await prisma.appointment.create({
      data: {
        clientId,              // scalar shortcut instead of nested connect
        adminId,               // same here
        date: new Date(date),
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees,
        paymentMethod: paymentMethod as any, // or cast to your enum
        notes:
          [template.notes, paymentMethodNote].filter(Boolean).join(' | ') ||
          undefined,
        observation: observation ?? undefined,
        status: status as any,
        lineage: 'single',
        // only include the relation if there are IDs
        ...(employeeIds.length > 0 && {
          employees: {
            connect: employeeIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    if (!noTeam && employeeIds.length) {
      await syncPayrollItems(appt.id, employeeIds)
    }

    return res.json(appt)
  } catch (err) {
    console.error('Error creating appointment:', err)
    return res.status(500).json({ error: 'Failed to create appointment' })
  }
}

export async function updateAppointment(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds,
      adminId,
      paid,
      paymentMethod,
      paymentMethodNote,
      tip,
      status,
      observe,
      carpetRooms,
      carpetPrice,
      carpetEmployees,
      observation,
      noTeam = false,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      status?: string
      observe?: boolean
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      observation?: string | null
      noTeam?: boolean
    }
    const data: any = {}
    if (clientId !== undefined) data.clientId = clientId
    if (templateId !== undefined) {
      const template = await prisma.appointmentTemplate.findUnique({
        where: { id: templateId },
      })
      if (!template) return res.status(400).json({ error: 'Invalid templateId' })
      data.type = template.type
      data.address = template.address
      data.cityStateZip = template.instructions ?? undefined
      data.size = template.size ?? undefined
      data.price = template.price
      data.notes = template.notes ?? data.notes
      if (carpetRooms === undefined && template.carpetRooms != null) {
        data.carpetRooms = template.carpetRooms
      }
      if (carpetPrice === undefined) {
        if (template.carpetPrice != null) {
          data.carpetPrice = template.carpetPrice
        } else if (
          (data.carpetRooms ?? template.carpetRooms) != null &&
          template.size
        ) {
          const cr = data.carpetRooms ?? template.carpetRooms
          const sqft = parseSqft(template.size)
          if (sqft !== null) {
            data.carpetPrice = cr * (sqft >= 4000 ? 40 : 35)
          }
        }
      }
    }
    if (date !== undefined) data.date = new Date(date)
    if (time !== undefined) data.time = time
    if (hours !== undefined) data.hours = hours
    if (adminId !== undefined) data.adminId = adminId
    if (paid !== undefined) data.paid = paid
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod as any
    if (paymentMethodNote !== undefined) data.notes = paymentMethodNote
    if (tip !== undefined) data.tip = tip
    if (noTeam !== undefined) data.noTeam = noTeam
    if (observation !== undefined) data.observation = observation
    if (status !== undefined) data.status = status as any
    if (observe !== undefined) data.observe = observe
    if (carpetRooms !== undefined) data.carpetRooms = carpetRooms
    if (carpetPrice !== undefined) data.carpetPrice = carpetPrice
    if (carpetEmployees !== undefined) data.carpetEmployees = carpetEmployees
    if (employeeIds) {
      data.employees = { set: employeeIds.map((id) => ({ id })) }
    }

    if (observe === false ||
        (status && ['CANCEL', 'RESCHEDULE_OLD', 'DELETED'].includes(status))) {
      data.observation = null
    }
    const future = req.query.future === 'true'
    const current = await prisma.appointment.findUnique({ where: { id }, include: { employees: true, client: true, admin: true } })
    if (!current) return res.status(404).json({ error: 'Not found' })

    const crypto = require('crypto')
    const convertToRecurring =
      current.lineage === 'single' && (data.status === 'REOCCURRING' || req.body.reoccurring)
    if (convertToRecurring) {
      const lineage = crypto.randomUUID()
      const frequency: string = req.body.frequency || 'WEEKLY'
      const nextDate = new Date(data.date ? new Date(data.date) : current.date)
      if (frequency === 'BIWEEKLY') nextDate.setDate(nextDate.getDate() + 14)
      else if (frequency === 'EVERY3') nextDate.setDate(nextDate.getDate() + 21)
      else if (frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (frequency === 'CUSTOM') {
        const m = parseInt(String(req.body.months || 1), 10)
        nextDate.setMonth(nextDate.getMonth() + (isNaN(m) ? 1 : m))
      } else nextDate.setDate(nextDate.getDate() + 7)

      const updated = await prisma.appointment.update({
        where: { id: current.id },
        data: { ...data, lineage, reoccurring: true, reocuringDate: nextDate },
        include: { employees: true, client: true, admin: true },
      })
      return res.json(updated)
    }

    if (future && current.lineage !== 'single') {
      function toMinutes(t: string) {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      function minutesToTime(m: number) {
        const hh = Math.floor(((m % 1440) + 1440) % 1440 / 60)
        const mm = Math.floor(((m % 1440) + 1440) % 1440 % 60)
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
      }

      const dateDiff = data.date ? new Date(data.date).getTime() - current.date.getTime() : 0
      const timeDiff = data.time ? toMinutes(data.time) - toMinutes(current.time) : 0
      const base: any = { ...data }
      delete base.date
      delete base.time

      const targets = await prisma.appointment.findMany({
        where: { lineage: current.lineage, date: { gte: current.date } },
        orderBy: { date: 'asc' },
        include: { employees: true },
      })

      for (const appt of targets) {
        const newDate = data.date ? new Date(appt.date.getTime() + dateDiff) : appt.date
        const newTime = data.time ? minutesToTime(toMinutes(appt.time) + timeDiff) : appt.time
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { ...base, date: newDate, time: newTime },
        })
      }

      const appts = await prisma.appointment.findMany({
        where: { lineage: current.lineage, date: { gte: current.date } },
        include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
        orderBy: { date: 'asc' },
      })
      res.json(appts)
    } else {
      const appt = await prisma.appointment.update({
        where: { id },
        data,
        include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
      })
      if (appt.status === 'CANCEL' || appt.status === 'DELETED') {
        await prisma.payrollItem.deleteMany({ where: { appointmentId: appt.id } })
      } else if (employeeIds && !noTeam) {
        await syncPayrollItems(appt.id, employeeIds)
      }
      res.json(appt)
    }
  } catch (e) {
    console.error('Error updating appointment:', e)
    res.status(500).json({ error: 'Failed to update appointment' })
  }
}

export async function sendAppointmentInfo(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const note = String((req.body as any).note || '')
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    if (!appt) return res.status(404).json({ error: 'Not found' })

    const pay = calculatePayRate(appt.type, appt.size ?? null, appt.employees.length || 1)
    const carpetIds = appt.carpetEmployees || []
    const carpetPer =
      appt.carpetRooms && appt.size && carpetIds.length
        ? calculateCarpetRate(appt.size, appt.carpetRooms) / carpetIds.length
        : 0

    for (const e of appt.employees) {
      const extras =
        appt.payrollItems.find((p: any) => p.employeeId === e.id)?.extras || []
      const extrasTotal = extras.reduce(
        (sum: number, ex: any) => sum + ex.amount,
        0,
      )
      const total = pay + (carpetIds.includes(e.id) ? carpetPer : 0) + extrasTotal
      const body = [
        `New appointment from Evidence Cleaning!`,
        `Appointment Date: ${appt.date.toISOString().slice(0, 10)}`,
        `Appointment Time: ${appt.time}`,
        `Appointment Type: ${appt.type}`,
        `Address: ${appt.address}`,
        `Pay: $${total.toFixed(2)}`,
        appt.cityStateZip ? `Instructions: ${appt.cityStateZip}` : undefined,
        note && `Note: ${note}`,
        `\n Please do not respond to this message`,
      ]
        .filter(Boolean)
        .join('\n')

      await smsClient.messages.create({
        to: e.number.startsWith('+') ? e.number : `+${e.number}`,
        from: process.env.TWILIO_FROM_NUMBER || '',
        body,
      })
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { infoSent: true },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    res.json(updated)
  } catch (err) {
    console.error('Failed to send appointment info:', err)
    res.status(500).json({ error: 'Failed to send info' })
  }
}
