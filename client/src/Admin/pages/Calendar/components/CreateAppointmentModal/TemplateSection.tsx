import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { AppointmentTemplate } from '../../types'

interface TemplateSectionProps {
  selectedClient: { id: number } | null
  selectedTemplate: number | null
  setSelectedTemplate: (templateId: number | null) => void
  templates: AppointmentTemplate[]
  setTemplates: (templates: AppointmentTemplate[]) => void
  showNewTemplate: boolean
  setShowNewTemplate: (show: boolean) => void
  templateForm: {
    templateName: string
    type: string
    size: string
    address: string
    price: string
    notes: string
    instructions: string
    carpetEnabled: boolean
    carpetRooms: string
    carpetPrice: string
  }
  setTemplateForm: (form: any) => void
  editing: boolean
  setEditing: (editing: boolean) => void
  editingTemplateId: number | null
  setEditingTemplateId: (id: number | null) => void
  onTemplateCreated?: (template: AppointmentTemplate) => void
}

export default function TemplateSection({
  selectedClient,
  selectedTemplate,
  setSelectedTemplate,
  templates,
  setTemplates,
  showNewTemplate,
  setShowNewTemplate,
  templateForm,
  setTemplateForm,
  editing,
  setEditing,
  editingTemplateId,
  setEditingTemplateId,
  onTemplateCreated,
}: TemplateSectionProps) {
  const fetchTemplates = async (clientId: number) => {
    try {
      const data = await fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${clientId}`)
      setTemplates(data)
    } catch {
      setTemplates([])
    }
  }

  const createTemplate = async () => {
    if (!templateForm.templateName.trim() || !templateForm.address.trim() || !templateForm.price.trim()) {
      return
    }
    try {
      const template = await fetchJson(`${API_BASE_URL}/appointment-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient!.id,
          templateName: templateForm.templateName,
          type: templateForm.type,
          size: templateForm.size,
          address: templateForm.address,
          price: Number(templateForm.price),
          notes: templateForm.notes,
          instructions: templateForm.instructions,
          carpetRooms: templateForm.carpetEnabled ? Number(templateForm.carpetRooms) : null,
          carpetPrice: templateForm.carpetEnabled ? Number(templateForm.carpetPrice) : null,
        }),
      })
      setSelectedTemplate(template.id)
      setShowNewTemplate(false)
      setTemplateForm({
        templateName: '',
        type: 'STANDARD',
        size: '',
        address: '',
        price: '',
        notes: '',
        instructions: '',
        carpetEnabled: false,
        carpetRooms: '',
        carpetPrice: '',
      })
      onTemplateCreated?.(template)
    } catch (error) {
      alert('Failed to create template')
    }
  }

  const updateTemplate = async () => {
    if (!editingTemplateId || !templateForm.templateName.trim() || !templateForm.address.trim() || !templateForm.price.trim()) {
      return
    }
    try {
      const template = await fetchJson(`${API_BASE_URL}/appointment-templates/${editingTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: templateForm.templateName,
          type: templateForm.type,
          size: templateForm.size,
          address: templateForm.address,
          price: Number(templateForm.price),
          notes: templateForm.notes,
          instructions: templateForm.instructions,
          carpetRooms: templateForm.carpetEnabled ? Number(templateForm.carpetRooms) : null,
          carpetPrice: templateForm.carpetEnabled ? Number(templateForm.carpetPrice) : null,
        }),
      })
      setEditing(false)
      setEditingTemplateId(null)
      setTemplateForm({
        templateName: '',
        type: 'STANDARD',
        size: '',
        address: '',
        price: '',
        notes: '',
        instructions: '',
        carpetEnabled: false,
        carpetRooms: '',
        carpetPrice: '',
      })
      onTemplateCreated?.(template)
    } catch (error) {
      alert('Failed to update template')
    }
  }

  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }
    try {
      await fetchJson(`${API_BASE_URL}/appointment-templates/${templateId}`, {
        method: 'DELETE',
      })
      setTemplates(templates.filter(t => t.id !== templateId))
      if (selectedTemplate === templateId) {
        setSelectedTemplate(null)
      }
    } catch (error) {
      alert('Failed to delete template')
    }
  }

  useEffect(() => {
    if (selectedClient) {
      fetchTemplates(selectedClient.id)
    } else {
      setTemplates([])
    }
  }, [selectedClient])

  const isTemplateReady =
    templateForm.templateName.trim() !== '' &&
    templateForm.address.trim() !== '' &&
    templateForm.price.trim() !== '' &&
    (!templateForm.carpetEnabled || templateForm.carpetRooms.trim() !== '')

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-2">Template</h3>
      {selectedTemplate ? (
        <div className="bg-gray-100 p-3 rounded">
          <div className="font-medium">
            {templates.find(t => t.id === selectedTemplate)?.templateName}
          </div>
          <div className="text-sm">
            {templates.find(t => t.id === selectedTemplate)?.address}
          </div>
          <button
            className="text-blue-500 text-sm mt-1"
            onClick={() => setSelectedTemplate(null)}
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          {templates.length > 0 && (
            <div className="max-h-40 overflow-y-auto border rounded mb-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="font-medium">{template.templateName}</div>
                  <div className="text-sm">{template.address}</div>
                  <div className="text-sm">${template.price}</div>
                </div>
              ))}
            </div>
          )}
          <button
            className="text-blue-500 text-sm"
            onClick={() => setShowNewTemplate(true)}
          >
            + Create new template
          </button>
        </div>
      )}

      {showNewTemplate && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h4 className="font-medium mb-2">New Template</h4>
          <input
            type="text"
            placeholder="Template name"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.templateName}
            onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
          />
          <select
            className="w-full border p-2 rounded mb-2"
            value={templateForm.type}
            onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
          >
            <option value="STANDARD">Standard</option>
            <option value="DEEP">Deep</option>
            <option value="MOVE_IN_OUT">Move in/out</option>
          </select>
          <input
            type="text"
            placeholder="Size (e.g., 2000-2500)"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.size}
            onChange={(e) => setTemplateForm({ ...templateForm, size: e.target.value })}
          />
          <input
            type="text"
            placeholder="Address"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.address}
            onChange={(e) => setTemplateForm({ ...templateForm, address: e.target.value })}
          />
          <input
            type="number"
            placeholder="Price"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.price}
            onChange={(e) => setTemplateForm({ ...templateForm, price: e.target.value })}
          />
          <textarea
            placeholder="Notes (optional)"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.notes}
            onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
          />
          <textarea
            placeholder="Instructions (optional)"
            className="w-full border p-2 rounded mb-2"
            value={templateForm.instructions}
            onChange={(e) => setTemplateForm({ ...templateForm, instructions: e.target.value })}
          />
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={templateForm.carpetEnabled}
              onChange={(e) => setTemplateForm({ ...templateForm, carpetEnabled: e.target.checked })}
              className="mr-2"
            />
            Include carpet cleaning
          </label>
          {templateForm.carpetEnabled && (
            <>
              <input
                type="number"
                placeholder="Number of carpet rooms"
                className="w-full border p-2 rounded mb-2"
                value={templateForm.carpetRooms}
                onChange={(e) => setTemplateForm({ ...templateForm, carpetRooms: e.target.value })}
              />
              <input
                type="number"
                placeholder="Carpet price"
                className="w-full border p-2 rounded mb-2"
                value={templateForm.carpetPrice}
                onChange={(e) => setTemplateForm({ ...templateForm, carpetPrice: e.target.value })}
              />
            </>
          )}
          <div className="flex gap-2">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
              onClick={createTemplate}
              disabled={!isTemplateReady}
            >
              Create
            </button>
            <button
              className="bg-gray-500 text-white px-4 py-2 rounded"
              onClick={() => setShowNewTemplate(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
