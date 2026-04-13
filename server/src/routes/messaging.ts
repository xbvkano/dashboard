import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import {
  deleteConversationPresence,
  deleteMessagingInboxLease,
  getConversationDetail,
  listConversations,
  patchConversationClient,
  postConversationPresence,
  postInboundWebhook,
  postMarkConversationRead,
  postMessagingInboxLease,
  postMessagingTranslate,
  postMockAppointmentExtraction,
  postOutboundMessage,
  postStartConversationFromContact,
} from '../controllers/messagingController'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
})

/** Parse multipart fields + `media` files; JSON requests skip this (no Content-Type match). */
function optionalOutboundMultipart(req: Request, res: Response, next: NextFunction) {
  const ct = String(req.headers['content-type'] ?? '')
  if (ct.includes('multipart/form-data')) {
    return upload.array('media', 10)(req, res, next)
  }
  next()
}

router.get('/messaging/conversations', listConversations)
router.post('/messaging/inbox/lease', postMessagingInboxLease)
router.delete('/messaging/inbox/lease', deleteMessagingInboxLease)
router.post('/messaging/translate', postMessagingTranslate)
router.post('/messaging/contacts/start', postStartConversationFromContact)
router.post('/messaging/conversations/:id/read', postMarkConversationRead)
router.post('/messaging/conversations/:id/presence', postConversationPresence)
router.delete('/messaging/conversations/:id/presence', deleteConversationPresence)
router.get('/messaging/conversations/:id', getConversationDetail)
router.patch('/messaging/conversations/:id/client', patchConversationClient)
router.post('/messaging/conversations/:id/messages', optionalOutboundMultipart, postOutboundMessage)
router.post('/messaging/inbound', postInboundWebhook)
router.post('/messaging/sessions/:sessionId/extract-appointment', postMockAppointmentExtraction)

export default router
