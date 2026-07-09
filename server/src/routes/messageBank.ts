import { Router } from 'express'
import {
  listMessageBankTemplates,
  getMessageBankTemplate,
  createMessageBankTemplate,
  updateMessageBankTemplate,
  deleteMessageBankTemplate,
  listMessageBankGroups,
  createMessageBankGroup,
  updateMessageBankGroup,
  deleteMessageBankGroup,
} from '../controllers/messageBankController'

const router = Router()

router.get('/message-bank/templates', listMessageBankTemplates)
router.post('/message-bank/templates', createMessageBankTemplate)
router.get('/message-bank/templates/:id', getMessageBankTemplate)
router.put('/message-bank/templates/:id', updateMessageBankTemplate)
router.delete('/message-bank/templates/:id', deleteMessageBankTemplate)

router.get('/message-bank/groups', listMessageBankGroups)
router.post('/message-bank/groups', createMessageBankGroup)
router.put('/message-bank/groups/:id', updateMessageBankGroup)
router.delete('/message-bank/groups/:id', deleteMessageBankGroup)

export default router
