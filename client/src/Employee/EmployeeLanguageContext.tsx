import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type EmployeeLanguage = 'en' | 'pt' | 'es'

const STORAGE_KEY = 'employee-language'

const scheduleTranslations = {
  en: {
    // Page header
    mySchedule: 'My Schedule',
    loading: 'Loading...',
    subtitle: 'Tap AM or PM to add your availability for the next 14 days',

    // Information section
    information: 'Information',
    open: 'Open',
    openDesc: 'You are not available during these time periods and will not be scheduled for jobs. Tap to select and save if you become available.',
    selectedNotSaved: 'Selected (not yet saved)',
    selectedNotSavedDesc: 'You have selected these times but have not saved yet. Tap Save Schedule to confirm.',
    availability: 'Availability',
    availabilityDesc: 'This is the availability you requested. These are saved and cannot be removed from this page. Contact your supervisor to change them.',
    scheduled: 'Scheduled',
    scheduledDesc: 'A job has been assigned and you have confirmed. This block is locked; details are on Upcoming Jobs.',
    scheduleUpdatePolicy: 'Schedule update policy',
    policyNextUpdateDate: 'Your next required update date is {date}.',
    policySummary: 'You are to update your availability every {updateDay}. Every day after the day you were supposed to update your availability you will get a text message reminding you to do so. After {supervisorDays} days, your supervisor will also get a message. After {stopDays} days of reminders you will no longer get text messages.',
    policyUpdateDayPlaceholder: 'update day',
    policySupervisorDaysPlaceholder: 'N',
    policyStopDaysPlaceholder: 'M',
    scheduleUpdateReminder: 'Please update your schedule by {updateDay}. You\'ll receive daily reminders until you update.',
    dayNamesLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const,

    // Supervisor note
    removeAvailabilityNote: 'Need to remove availability? Contact your supervisor — you cannot remove saved times from this page.',

    // Last update
    neverUpdated: 'Never updated',
    updatedToday: 'Updated today',
    updatedOneDayAgo: 'Updated 1 day ago',
    updatedDaysAgo: (n: number) => `Updated ${n} days ago`,

    // Calendar
    next14Days: '(next 14 days)',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',

    // Legend
    legendOpen: 'Open',
    legendSelected: 'Selected (not yet saved)',
    legendAvailability: 'Availability',
    legendScheduled: 'Scheduled',
    legendUnconfirmed: 'Unconfirmed job',
    legendUpdateDueDate: 'Update due date',
    unconfirmedDesc: 'You have been assigned a job for this block but have not confirmed yet. Please confirm on the Upcoming Jobs page so we know you are coming. Unconfirmed jobs may be reassigned after 24 hours.',

    // Actions & messages
    saving: 'Saving...',
    saveSchedule: 'Save Schedule',
    confirmSaveTitle: 'Confirm Save Schedule',
    addingAvailability: 'You are adding the following availability:',
    morningAndAfternoon: 'Morning (AM) & Afternoon (PM)',
    morningOnly: 'Morning (AM)',
    afternoonOnly: 'Afternoon (PM)',
    noNewAvailability: 'You have no new availability to add.',
    importantNote: 'Important: Once saved, you cannot remove these times from your availability yourself. Contact your supervisor if you need to change your schedule.',
    cancel: 'Cancel',
    scheduleSaved: 'Schedule saved successfully!',
    failedToLoad: 'Failed to load schedule',
    failedToSave: 'Failed to save schedule',

    languageName: 'Language',
    languageEnglish: 'English',
    languagePortuguese: 'Portuguese',
    languageSpanish: 'Spanish',

    navSchedule: 'Schedule',
    navUpcomingJobs: 'Upcoming Jobs',
    navJobs: 'Jobs',
    navSignOut: 'Sign Out',
  },
  pt: {
    mySchedule: 'Minha Agenda',
    loading: 'Carregando...',
    subtitle: 'Toque em AM ou PM para adicionar sua disponibilidade nos próximos 14 dias',

    information: 'Informação',
    open: 'Livre',
    openDesc: 'Você não está disponível nestes períodos e não será agendado. Toque para selecionar e salvar quando estiver disponível.',
    selectedNotSaved: 'Selecionado (ainda não salvo)',
    selectedNotSavedDesc: 'Você selecionou estes horários mas ainda não salvou. Toque em Salvar Agenda para confirmar.',
    availability: 'Disponibilidade',
    availabilityDesc: 'Esta é a disponibilidade que você solicitou. Está salva e não pode ser removida nesta página. Entre em contato com seu supervisor para alterar.',
    scheduled: 'Agendado',
    scheduledDesc: 'Um trabalho foi atribuído e você confirmou. Este bloco está bloqueado; detalhes na página Próximos Trabalhos.',
    scheduleUpdatePolicy: 'Política de atualização da agenda',
    policyNextUpdateDate: 'Sua próxima data de atualização obrigatória é {date}.',
    policySummary: 'Você deve atualizar sua disponibilidade todo {updateDay}. Todos os dias após a data em que você deveria atualizar sua disponibilidade você receberá uma mensagem de texto lembrando-o de fazê-lo. Após {supervisorDays} dias, seu supervisor também receberá uma mensagem. Após {stopDays} dias de lembretes você não receberá mais mensagens de texto.',
    policyUpdateDayPlaceholder: 'dia de atualização',
    policySupervisorDaysPlaceholder: 'N',
    policyStopDaysPlaceholder: 'M',
    scheduleUpdateReminder: 'Atualize sua agenda até {updateDay}. Você receberá lembretes diários até atualizar.',
    dayNamesLong: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const,

    removeAvailabilityNote: 'Precisa remover disponibilidade? Entre em contato com seu supervisor — você não pode remover horários já salvos nesta página.',

    neverUpdated: 'Nunca atualizado',
    updatedToday: 'Atualizado hoje',
    updatedOneDayAgo: 'Atualizado há 1 dia',
    updatedDaysAgo: (n: number) => `Atualizado há ${n} dias`,

    next14Days: '(próximos 14 dias)',
    weekdays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    today: 'Hoje',

    legendOpen: 'Livre',
    legendSelected: 'Selecionado (não salvo)',
    legendAvailability: 'Disponibilidade',
    legendScheduled: 'Agendado',
    legendUnconfirmed: 'Trabalho não confirmado',
    legendUpdateDueDate: 'Data de atualização',
    unconfirmedDesc: 'Você foi atribuído a um trabalho neste período mas ainda não confirmou. Confirme na página Próximos Trabalhos para confirmar sua presença. Trabalhos não confirmados podem ser reatribuídos após 24 horas.',

    saving: 'Salvando...',
    saveSchedule: 'Salvar Agenda',
    confirmSaveTitle: 'Confirmar Salvar Agenda',
    addingAvailability: 'Você está adicionando a seguinte disponibilidade:',
    morningAndAfternoon: 'Manhã (AM) e Tarde (PM)',
    morningOnly: 'Manhã (AM)',
    afternoonOnly: 'Tarde (PM)',
    noNewAvailability: 'Você não tem nova disponibilidade para adicionar.',
    importantNote: 'Importante: Depois de salvo, você não poderá remover estes horários da sua disponibilidade. Entre em contato com seu supervisor se precisar alterar sua agenda.',
    cancel: 'Cancelar',
    scheduleSaved: 'Agenda salva com sucesso!',
    failedToLoad: 'Falha ao carregar a agenda',
    failedToSave: 'Falha ao salvar a agenda',

    languageName: 'Idioma',
    languageEnglish: 'Inglês',
    languagePortuguese: 'Português',
    languageSpanish: 'Espanhol',

    navSchedule: 'Agenda',
    navUpcomingJobs: 'Próximos Trabalhos',
    navJobs: 'Trabalhos',
    navSignOut: 'Sair',
  },
  es: {
    mySchedule: 'Mi Horario',
    loading: 'Cargando...',
    subtitle: 'Toca AM o PM para añadir tu disponibilidad en los próximos 14 días',

    information: 'Información',
    open: 'Libre',
    openDesc: 'No estás disponible en estos períodos y no serás programado. Toca para seleccionar y guardar cuando estés disponible.',
    selectedNotSaved: 'Seleccionado (aún no guardado)',
    selectedNotSavedDesc: 'Has seleccionado estos horarios pero aún no has guardado. Toca Guardar Horario para confirmar.',
    availability: 'Disponibilidad',
    availabilityDesc: 'Esta es la disponibilidad que solicitaste. Está guardada y no se puede quitar en esta página. Contacta a tu supervisor para cambiarla.',
    scheduled: 'Programado',
    scheduledDesc: 'Te han asignado un trabajo y lo has confirmado. Este bloque está bloqueado; los detalles están en Próximos Trabajos.',
    scheduleUpdatePolicy: 'Política de actualización del horario',
    policyNextUpdateDate: 'Tu próxima fecha de actualización obligatoria es {date}.',
    policySummary: 'Debes actualizar tu disponibilidad cada {updateDay}. Cada día después de la fecha en que debías actualizar tu disponibilidad recibirás un mensaje de texto recordándotelo. Después de {supervisorDays} días, tu supervisor también recibirá un mensaje. Después de {stopDays} días de recordatorios ya no recibirás mensajes de texto.',
    policyUpdateDayPlaceholder: 'día de actualización',
    policySupervisorDaysPlaceholder: 'N',
    policyStopDaysPlaceholder: 'M',
    scheduleUpdateReminder: 'Actualiza tu horario antes del {updateDay}. Recibirás recordatorios diarios hasta que actualices.',
    dayNamesLong: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const,

    removeAvailabilityNote: '¿Necesitas quitar disponibilidad? Contacta a tu supervisor — no puedes quitar horarios ya guardados en esta página.',

    neverUpdated: 'Nunca actualizado',
    updatedToday: 'Actualizado hoy',
    updatedOneDayAgo: 'Actualizado hace 1 día',
    updatedDaysAgo: (n: number) => `Actualizado hace ${n} días`,

    next14Days: '(próximos 14 días)',
    weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy',

    legendOpen: 'Libre',
    legendSelected: 'Seleccionado (no guardado)',
    legendAvailability: 'Disponibilidad',
    legendScheduled: 'Programado',
    legendUnconfirmed: 'Trabajo sin confirmar',
    legendUpdateDueDate: 'Fecha de actualización',
    unconfirmedDesc: 'Te han asignado un trabajo en este horario pero aún no lo has confirmado. Confirma en la página Próximos Trabajos para que sepamos que vendrás. Los trabajos sin confirmar pueden reasignarse después de 24 horas.',

    saving: 'Guardando...',
    saveSchedule: 'Guardar Horario',
    confirmSaveTitle: 'Confirmar Guardar Horario',
    addingAvailability: 'Estás añadiendo la siguiente disponibilidad:',
    morningAndAfternoon: 'Mañana (AM) y Tarde (PM)',
    morningOnly: 'Mañana (AM)',
    afternoonOnly: 'Tarde (PM)',
    noNewAvailability: 'No tienes nueva disponibilidad para añadir.',
    importantNote: 'Importante: Una vez guardado, no podrás quitar estos horarios de tu disponibilidad. Contacta a tu supervisor si necesitas cambiar tu horario.',
    cancel: 'Cancelar',
    scheduleSaved: '¡Horario guardado correctamente!',
    failedToLoad: 'Error al cargar el horario',
    failedToSave: 'Error al guardar el horario',

    languageName: 'Idioma',
    languageEnglish: 'Inglés',
    languagePortuguese: 'Portugués',
    languageSpanish: 'Español',

    navSchedule: 'Horario',
    navUpcomingJobs: 'Próximos Trabajos',
    navJobs: 'Trabajos',
    navSignOut: 'Cerrar sesión',
  },
} as const

export type ScheduleTranslations = typeof scheduleTranslations.en

const translations = scheduleTranslations

interface EmployeeLanguageContextValue {
  language: EmployeeLanguage
  setLanguage: (lang: EmployeeLanguage) => void
  t: ScheduleTranslations
  locale: string // for toLocaleDateString, e.g. 'en-US', 'pt-BR', 'es-ES'
}

const localeMap: Record<EmployeeLanguage, string> = {
  en: 'en-US',
  pt: 'pt-BR',
  es: 'es-ES',
}

const EmployeeLanguageContext = createContext<EmployeeLanguageContextValue | null>(null)

function getStoredLanguage(): EmployeeLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'pt' || stored === 'es') return stored
  } catch {
    // ignore
  }
  return 'en'
}

export function EmployeeLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<EmployeeLanguage>(getStoredLanguage)

  const setLanguage = useCallback((lang: EmployeeLanguage) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const stored = getStoredLanguage()
    if (stored !== language) setLanguageState(stored)
  }, [])

  const t = translations[language]
  const locale = localeMap[language]

  const value: EmployeeLanguageContextValue = {
    language,
    setLanguage,
    t,
    locale,
  }

  return (
    <EmployeeLanguageContext.Provider value={value}>
      {children}
    </EmployeeLanguageContext.Provider>
  )
}

export function useEmployeeLanguage() {
  const ctx = useContext(EmployeeLanguageContext)
  if (!ctx) throw new Error('useEmployeeLanguage must be used within EmployeeLanguageProvider')
  return ctx
}
