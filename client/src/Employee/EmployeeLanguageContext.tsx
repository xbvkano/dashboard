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
    scheduledDesc: 'You have been scheduled for a job during this time. Your assigned jobs can be viewed on the Upcoming Jobs page.',
    scheduleUpdatePolicy: 'Schedule update policy',
    policy1: 'You must update your schedule every Sunday.',
    policy2: 'If it has been more than 7 days since your last update, you will receive a reminder text message each day until you update.',
    policy3: 'If it has been 10 days since your last update, your supervisor will also receive a text message. This continues until you update your schedule or your account is disabled.',

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
    scheduledDesc: 'Você foi agendado para um trabalho neste período. Seus trabalhos atribuídos podem ser vistos na página Próximos Trabalhos.',
    scheduleUpdatePolicy: 'Política de atualização da agenda',
    policy1: 'Você deve atualizar sua agenda todo domingo.',
    policy2: 'Se passaram mais de 7 dias desde sua última atualização, você receberá um lembrete por mensagem de texto a cada dia até atualizar.',
    policy3: 'Se passaram 10 dias desde sua última atualização, seu supervisor também receberá uma mensagem de texto. Isso continua até você atualizar sua agenda ou sua conta ser desativada.',

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
    scheduledDesc: 'Has sido programado para un trabajo en este horario. Tus trabajos asignados se pueden ver en la página Próximos Trabajos.',
    scheduleUpdatePolicy: 'Política de actualización del horario',
    policy1: 'Debes actualizar tu horario cada domingo.',
    policy2: 'Si han pasado más de 7 días desde tu última actualización, recibirás un recordatorio por mensaje de texto cada día hasta que actualices.',
    policy3: 'Si han pasado 10 días desde tu última actualización, tu supervisor también recibirá un mensaje de texto. Esto continúa hasta que actualices tu horario o tu cuenta sea desactivada.',

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
