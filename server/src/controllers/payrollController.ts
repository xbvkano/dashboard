import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'

const prisma = new PrismaClient()

export async function getPayrollDue(_req: Request, res: Response) {
  const items = await prisma.payrollItem.findMany({
    where: { paid: false },
    include: {
      appointment: { include: { employees: true } },
      employee: true,
      extras: true,
    },
  })
  const others = await prisma.manualPayrollItem.findMany({
    where: { paid: false, payrollItemId: null },
    include: { employee: true },
  })
  const map: Record<number, any> = {}
  for (const it of items) {
    const e = it.employee
    const appt = it.appointment
    const count = appt.employees.length || 1
    const pay = calculatePayRate(appt.type, appt.size ?? null, count)
    const carpetIds = appt.carpetEmployees || []
    const carpetShare =
      appt.carpetRooms && appt.size && carpetIds.length
        ? calculateCarpetRate(appt.size, appt.carpetRooms) / carpetIds.length
        : 0
    if (!map[e.id]) {
      map[e.id] = { employee: e, items: [], total: e.prevBalance || 0 }
      if (e.prevBalance && e.prevBalance !== 0) {
        map[e.id].items.push({
          service: e.prevBalance > 0 ? 'Previous balance' : 'Credit',
          date: e.lastPaidAt,
          amount: e.prevBalance,
          selectable: false,
        })
      }
    }
    const basePay = it.amount != null ? it.amount : pay
    const amount = basePay + (carpetIds.includes(e.id) ? carpetShare : 0)
    const extras = it.extras.map((ex: any) => ({ id: ex.id, name: ex.name, amount: ex.amount }))
    map[e.id].items.push({
      id: it.id,
      service: appt.type,
      date: appt.date,
      amount,
      extras,
    })
    map[e.id].total += amount
    for (const ex of extras) {
      map[e.id].total += ex.amount
    }
  }
  for (const ot of others) {
    const e = ot.employee
    if (!map[e.id]) {
      map[e.id] = { employee: e, items: [], total: e.prevBalance || 0 }
      if (e.prevBalance && e.prevBalance !== 0) {
        map[e.id].items.push({
          service: e.prevBalance > 0 ? 'Previous balance' : 'Credit',
          date: e.lastPaidAt,
          amount: e.prevBalance,
          selectable: false,
        })
      }
    }
    map[e.id].items.push({
      id: ot.id,
      service: ot.name,
      date: ot.createdAt,
      amount: ot.amount,
      manual: true,
    })
    map[e.id].total += ot.amount
  }
  // include employees that only have a previous balance
  const balancedEmployees = await prisma.employee.findMany({ where: { prevBalance: { not: 0 } } })
  for (const e of balancedEmployees) {
    if (!map[e.id]) {
      map[e.id] = { employee: e, items: [], total: e.prevBalance }
      map[e.id].items.push({
        service: e.prevBalance > 0 ? 'Previous balance' : 'Credit',
        date: e.lastPaidAt,
        amount: e.prevBalance,
        selectable: false,
      })
    }
  }
  res.json(Object.values(map))
}

export async function createManualPayrollItem(req: Request, res: Response) {
  const { employeeId, name, amount } = req.body as {
    employeeId?: number
    name?: string
    amount?: number
  }
  if (!employeeId || amount == null) {
    return res.status(400).json({ error: 'employeeId and amount required' })
  }
  const item = await prisma.manualPayrollItem.create({
    data: {
      employeeId,
      name: name || 'Other',
      amount,
    },
  })
  res.json({ id: item.id })
}

export async function updateManualPayrollItem(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { name, amount } = req.body as { name?: string; amount?: number }
  if (!id || amount == null) {
    return res.status(400).json({ error: 'id and amount required' })
  }
  const item = await prisma.manualPayrollItem.update({
    where: { id },
    data: { name: name || 'Other', amount },
  })
  res.json({ id: item.id, name: item.name, amount: item.amount })
}

export async function createPayrollExtra(req: Request, res: Response) {
  const { appointmentId, payrollItemId, employeeId, name, amount } = req.body as {
    appointmentId?: number
    payrollItemId?: number
    employeeId?: number
    name?: string
    amount?: number
  }
  if ((!appointmentId && !payrollItemId) || !employeeId || amount == null) {
    return res
      .status(400)
      .json({ error: 'appointmentId or payrollItemId, employeeId and amount required' })
  }
  const payrollItem = await prisma.payrollItem.findFirst({
    where: payrollItemId
      ? { id: payrollItemId, employeeId }
      : { appointmentId: appointmentId!, employeeId },
  })
  if (!payrollItem) {
    return res.status(404).json({ error: 'payroll item not found' })
  }
  const extra = await prisma.manualPayrollItem.create({
    data: {
      employeeId,
      payrollItemId: payrollItem.id,
      name: name || 'Extra',
      amount,
    },
  })
  res.json({
    id: extra.id,
    employeeId: extra.employeeId,
    name: extra.name,
    amount: extra.amount,
  })
}

export async function updatePayrollExtra(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { name, amount } = req.body as { name?: string; amount?: number }
  if (!id || amount == null) {
    return res.status(400).json({ error: 'id and amount required' })
  }
  const extra = await prisma.manualPayrollItem.update({
    where: { id },
    data: { name: name || 'Extra', amount },
  })
  res.json({ id: extra.id, name: extra.name, amount: extra.amount })
}

export async function deletePayrollExtra(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'id required' })
  try {
    await prisma.manualPayrollItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'extra not found' })
  }
}

export async function getPayrollPaid(_req: Request, res: Response) {
  const payments = await prisma.employeePayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      employee: true,
      items: { include: { appointment: { include: { employees: true } }, extras: true } },
      manualItems: true,
    },
  })
  const result = payments.map((p: any) => {
    const details: any[] = []
    for (const it of p.items) {
      const appt = it.appointment
      const count = appt.employees.length || 1
      let amt = calculatePayRate(appt.type, appt.size ?? null, count)
      if (appt.carpetRooms && appt.size && appt.carpetEmployees?.length) {
        const share =
          calculateCarpetRate(appt.size, appt.carpetRooms) /
          appt.carpetEmployees.length
        if (appt.carpetEmployees.includes(p.employeeId)) amt += share
      }
      const extras = it.extras.map((ex: any) => ({ id: ex.id, name: ex.name, amount: ex.amount }))
      details.push({ service: appt.type, date: appt.date, amount: amt, extras })
    }
    for (const mi of p.manualItems.filter((m: any) => !m.payrollItemId)) {
      details.push({ service: mi.name, date: mi.createdAt, amount: mi.amount, manual: true })
    }
    return {
      id: p.id,
      employee: { id: p.employee.id, name: p.employee.name },
      amount: p.amount,
      extra: p.extra,
      createdAt: p.createdAt,
      items: details,
    }
  })
  res.json(result)
}

export async function processPayrollPayment(req: Request, res: Response) {
  let { employeeId, amount, extra = 0, itemIds = [], manualIds = [] } =
    req.body as {
      employeeId?: number
      amount?: number
      extra?: number
      itemIds?: number[]
      manualIds?: number[]
    }
  if (!employeeId || amount == null) {
    return res.status(400).json({ error: 'employeeId and amount required' })
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'employee not found' })

  let items: any[] = []
  let manualItems: any[] = []
  if (itemIds.length || manualIds.length) {
    items = await prisma.payrollItem.findMany({
      where: { id: { in: itemIds }, employeeId, paid: false },
      include: { appointment: { include: { employees: true } } },
    })
    manualItems = await prisma.manualPayrollItem.findMany({
      where: { id: { in: manualIds }, employeeId, paid: false },
    })
  } else {
    items = await prisma.payrollItem.findMany({
      where: { employeeId, paid: false },
      include: { appointment: { include: { employees: true } } },
    })
    manualItems = await prisma.manualPayrollItem.findMany({
      where: { employeeId, paid: false },
    })
    let dueTotal = employee.prevBalance || 0
    for (const it of items) {
      const c = it.appointment.employees.length || 1
      dueTotal += calculatePayRate(it.appointment.type, it.appointment.size ?? null, c)
      if (
        it.appointment.carpetRooms &&
        it.appointment.size &&
        it.appointment.carpetEmployees?.length
      ) {
        const share =
          calculateCarpetRate(it.appointment.size, it.appointment.carpetRooms) /
          it.appointment.carpetEmployees.length
        if (it.appointment.carpetEmployees.includes(employeeId)) {
          dueTotal += share
        }
      }
    }
    for (const mi of manualItems) dueTotal += mi.amount
    if (amount >= dueTotal - 0.01) {
      itemIds = items.map((i: any) => i.id)
      manualIds = manualItems.map((m: any) => m.id)
    } else {
      items = []
      manualItems = []
    }
  }

  let itemsTotal = 0
  for (const it of items) {
    const c = it.appointment.employees.length || 1
    itemsTotal += calculatePayRate(it.appointment.type, it.appointment.size ?? null, c)
    if (
      it.appointment.carpetRooms &&
      it.appointment.size &&
      it.appointment.carpetEmployees?.length
    ) {
      const share =
        calculateCarpetRate(
          it.appointment.size,
          it.appointment.carpetRooms,
        ) / it.appointment.carpetEmployees.length
      if (it.appointment.carpetEmployees.includes(employeeId)) {
        itemsTotal += share
      }
    }
  }
  for (const mi of manualItems) itemsTotal += mi.amount

  const payment = await prisma.employeePayment.create({
    data: { employeeId, amount, extra },
  })
  if (items.length) {
    await prisma.payrollItem.updateMany({
      where: { id: { in: itemIds } },
      data: { paid: true, paymentId: payment.id },
    })
  }
  if (manualItems.length) {
    await prisma.manualPayrollItem.updateMany({
      where: { id: { in: manualIds } },
      data: { paid: true, paymentId: payment.id },
    })
  }

  let balance = (employee.prevBalance || 0) + itemsTotal - amount
  if (balance < 0) {
    await prisma.manualPayrollItem.create({
      data: {
        employeeId,
        name: 'Credit',
        amount: -balance,
        paid: true,
        paymentId: payment.id,
      },
    })
  }
  await prisma.employee.update({
    where: { id: employeeId },
    data: { prevBalance: balance, lastPaidAt: new Date() },
  })
  res.json({ id: payment.id })
}

export async function processPayrollChargeback(req: Request, res: Response) {
  const { id } = req.body as { id?: number }
  if (!id) return res.status(400).json({ error: 'id required' })
  const payment = await prisma.employeePayment.findUnique({
    where: { id },
    include: {
      employee: true,
      items: { include: { appointment: { include: { employees: true } }, extras: true } },
      manualItems: true,
    },
  })
  if (!payment) return res.status(404).json({ error: 'payment not found' })

  let itemsTotal = 0
  for (const it of payment.items) {
    const c = it.appointment.employees.length || 1
    itemsTotal += calculatePayRate(it.appointment.type, it.appointment.size ?? null, c)
    if (
      it.appointment.carpetRooms &&
      it.appointment.size &&
      it.appointment.carpetEmployees?.length
    ) {
      const share =
        calculateCarpetRate(it.appointment.size, it.appointment.carpetRooms) /
        it.appointment.carpetEmployees.length
      if (it.appointment.carpetEmployees.includes(payment.employeeId)) {
        itemsTotal += share
      }
    }
  }
  for (const ot of payment.manualItems) {
    itemsTotal += ot.amount
  }
  for (const it of payment.items) {
    for (const ex of it.extras) {
      itemsTotal += ex.amount
    }
  }

  if (payment.items.length) {
    await prisma.payrollItem.updateMany({
      where: { id: { in: payment.items.map((it: { id: number }) => it.id) } },
      data: { paid: false, paymentId: null },
    })
  }
  const manualIds = [
    ...payment.manualItems.map((o: { id: number }) => o.id),
    ...payment.items.flatMap((it: any) => it.extras.map((e: any) => e.id)),
  ]
  if (manualIds.length) {
    await prisma.manualPayrollItem.updateMany({
      where: { id: { in: manualIds } },
      data: { paid: false, paymentId: null },
    })
  }

  const prevBalance =
    (payment.employee.prevBalance || 0) + payment.amount - itemsTotal

  await prisma.employee.update({
    where: { id: payment.employeeId },
    data: { prevBalance },
  })

  await prisma.employeePayment.delete({ where: { id } })
  res.json({ ok: true })
}
