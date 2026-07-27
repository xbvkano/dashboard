import { Router } from 'express'
import { listAdminAccounts, updateAdminAccount } from '../controllers/adminAccountsController'

const router = Router()

router.get('/admin-accounts', listAdminAccounts)
router.patch('/admin-accounts/:id', updateAdminAccount)

export default router
