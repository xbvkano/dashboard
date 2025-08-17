import { Router } from 'express'
import { 
  createInvoice, 
  getInvoicePdf, 
  sendInvoice, 
  getRevenue 
} from '../controllers/invoicesController'

const router = Router()

// Invoice routes
router.post('/invoices', createInvoice)
router.get('/invoices/:id/pdf', getInvoicePdf)
router.post('/invoices/:id/send', sendInvoice)
router.get('/revenue', getRevenue)

export default router
