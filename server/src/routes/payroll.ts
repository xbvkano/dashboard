import { Router } from 'express'
import { 
  getPayrollDue,
  createManualPayrollItem,
  updateManualPayrollItem,
  createPayrollExtra,
  updatePayrollExtra,
  deletePayrollExtra,
  getPayrollPaid,
  processPayrollPayment,
  processPayrollChargeback
} from '../controllers/payrollController'

const router = Router()

// Payroll routes
router.get('/payroll/due', getPayrollDue)
router.post('/payroll/manual', createManualPayrollItem)
router.put('/payroll/manual/:id', updateManualPayrollItem)
router.post('/payroll/extra', createPayrollExtra)
router.put('/payroll/extra/:id', updatePayrollExtra)
router.delete('/payroll/extra/:id', deletePayrollExtra)
router.get('/payroll/paid', getPayrollPaid)
router.post('/payroll/pay', processPayrollPayment)
router.post('/payroll/chargeback', processPayrollChargeback)

export default router
