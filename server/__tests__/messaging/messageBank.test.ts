import {
  allActiveVariablesFilled,
  getVariableKeysInBodyOrder,
  excludedKeysFromInstanceBody,
  isDuplicateTemplateNameInGroup,
  parseVariablesFromBody,
  removeVariableFromBody,
  removeVariableFromBodyWithAnchor,
  reinsertTokenInBody,
  detectRemovedVariables,
  buildRemovalAnchor,
  renderMessageBankTemplate,
  slugifyVariableKey,
  suggestUniqueTemplateName,
  syncTemplateVariablesFromBody,
  type MessageBankTemplateShape,
} from '../../../client/src/shared/messageBank'

describe('messageBank', () => {
  describe('parseVariablesFromBody', () => {
    it('parses built-in and custom tokens', () => {
      const body = 'Hi {{Name}}, {{gate_code}} for {{ServiceType}} at {{Price}}'
      expect(parseVariablesFromBody(body)).toEqual({
        builtinKeys: ['name', 'serviceType', 'price'],
        customKeys: ['gate_code'],
      })
    })
  })

  describe('slugifyVariableKey', () => {
    it('generates unique slugs', () => {
      expect(slugifyVariableKey('Gate Code')).toBe('gate_code')
      expect(slugifyVariableKey('Gate Code', ['gate_code'])).toBe('gate_code_2')
    })
  })

  describe('renderMessageBankTemplate', () => {
    it('substitutes values', () => {
      const body = 'Hi {{Name}}, price {{Price}}'
      expect(
        renderMessageBankTemplate(body, { name: 'Jane', price: '360' }, []),
      ).toBe('Hi Jane, price $360')
    })

    it('strips excluded variables', () => {
      const body = 'Hi {{Name}}, price {{Price}}'
      expect(
        renderMessageBankTemplate(body, { name: 'Jane', price: '360' }, ['price']),
      ).toBe('Hi Jane, price')
    })
  })

  describe('removeVariableFromBody', () => {
    it('removes token from body', () => {
      expect(removeVariableFromBody('Hi {{Name}}, {{Price}} here', 'price')).toBe(
        'Hi {{Name}}, here',
      )
    })
  })

  describe('allActiveVariablesFilled', () => {
    const template: MessageBankTemplateShape = {
      name: 'T',
      body: '{{Name}} {{gate_code}}',
      builtinVariables: ['NAME'],
      customVariables: [{ key: 'gate_code', label: 'Gate Code' }],
    }

    it('requires all non-excluded variables', () => {
      expect(allActiveVariablesFilled(template, { name: 'A', gate_code: '1234' }, [])).toBe(true)
      expect(allActiveVariablesFilled(template, { name: 'A' }, [])).toBe(false)
      expect(allActiveVariablesFilled(template, { name: 'A' }, ['gate_code'])).toBe(true)
    })
  })

  describe('syncTemplateVariablesFromBody', () => {
    it('syncs builtins and keeps custom defs', () => {
      const synced = syncTemplateVariablesFromBody('{{Name}} {{gate_code}}', [
        { key: 'gate_code', label: 'Gate Code' },
      ])
      expect(synced.builtinVariables).toEqual(['NAME'])
      expect(synced.customVariables).toEqual([{ key: 'gate_code', label: 'Gate Code' }])
    })
  })

  describe('suggestUniqueTemplateName', () => {
    const templates = [
      { id: 1, name: 'Follow up', groupId: null },
      { id: 2, name: 'Follow up (2)', groupId: null },
      { id: 3, name: 'Follow up', groupId: 10 },
    ]

    it('detects duplicate within same group only', () => {
      expect(isDuplicateTemplateNameInGroup('Follow up', null, templates)).toBe(true)
      expect(isDuplicateTemplateNameInGroup('follow up', null, templates)).toBe(true)
      expect(isDuplicateTemplateNameInGroup('Follow up', 10, templates)).toBe(true)
      expect(isDuplicateTemplateNameInGroup('Follow up', 99, templates)).toBe(false)
    })

    it('increments suffix until free within group', () => {
      expect(suggestUniqueTemplateName('Follow up', null, templates)).toBe('Follow up (3)')
      expect(suggestUniqueTemplateName('Follow up', 10, templates)).toBe('Follow up (2)')
    })

    it('excludes current template when editing', () => {
      expect(isDuplicateTemplateNameInGroup('Follow up', null, templates, 1)).toBe(false)
      expect(isDuplicateTemplateNameInGroup('Follow up (2)', null, templates, 2)).toBe(false)
    })
  })

  describe('getVariableKeysInBodyOrder', () => {
    it('orders keys by first appearance in body', () => {
      const template: MessageBankTemplateShape = {
        name: 'T',
        body: 'Hi {{Name}}, {{gate_code}} for {{ServiceType}} at {{Price}}',
        builtinVariables: ['NAME', 'PRICE', 'SERVICE_TYPE'],
        customVariables: [{ key: 'gate_code', label: 'Gate Code' }],
      }
      expect(getVariableKeysInBodyOrder(template)).toEqual([
        'name',
        'gate_code',
        'serviceType',
        'price',
      ])
    })
  })

  describe('excludedKeysFromInstanceBody', () => {
    it('marks keys whose token was removed from instance body', () => {
      const template: MessageBankTemplateShape = {
        name: 'T',
        body: 'Hi {{Name}}, {{Price}}',
        builtinVariables: ['NAME', 'PRICE'],
        customVariables: [],
      }
      expect(excludedKeysFromInstanceBody(template, 'Hi {{Name}}')).toEqual(['price'])
      expect(excludedKeysFromInstanceBody(template, 'Hi {{Name}}, {{Price}}')).toEqual([])
    })
  })

  describe('reinsertTokenInBody', () => {
    const template: MessageBankTemplateShape = {
      name: 'T',
      body: 'Hi {{Name}}, {{Price}}',
      builtinVariables: ['NAME', 'PRICE'],
      customVariables: [],
    }

    it('reinserts at the original index when body unchanged', () => {
      const body = 'Hi {{Name}}, call us'
      const { body: without, anchor } = removeVariableFromBodyWithAnchor(body, 'name')!
      expect(reinsertTokenInBody(without, 'name', anchor)).toBe('Hi {{Name}}, call us')
    })

    it('round-trips Hello {{Name}} world exactly', () => {
      const body = 'Hello {{Name}} world'
      const { body: without, anchor } = removeVariableFromBodyWithAnchor(body, 'name')!
      expect(without).toBe('Hello world')
      expect(reinsertTokenInBody(without, 'name', anchor)).toBe(body)
    })

    it('reinserts near proportional position when body length changed', () => {
      const original = 'AAAA {{Name}} BBBB'
      const anchor = buildRemovalAnchor(original, 'name')!
      const shortened = 'AA BB'
      const restored = reinsertTokenInBody(shortened, 'name', anchor)
      expect(restored).toContain('{{Name}}')
      expect(restored.indexOf('{{Name}}')).toBeLessThan(restored.indexOf('BB'))
    })

    it('restores via anchor match after unrelated edits', () => {
      const body = 'Hi {{Name}}, call us today'
      const { body: without, anchor } = removeVariableFromBodyWithAnchor(body, 'name')!
      const edited = without.replace('call us', 'reach us')
      const restored = reinsertTokenInBody(edited, 'name', anchor)
      expect(restored).toBe('Hi {{Name}}, reach us today')
    })

    it('detects edit-mode removal and restores at original gap', () => {
      const prev = 'Hi {{Name}}, call us'
      const next = 'Hi , call us'
      const removals = detectRemovedVariables(prev, next, template)
      expect(removals.name).toBeDefined()
      const restored = reinsertTokenInBody(next, 'name', removals.name)
      expect(restored).toBe('Hi {{Name}}, call us')
    })

    it('undoes multiple removals independently', () => {
      const body = 'Hi {{Name}}, price {{Price}} here'
      const { body: withoutName, anchor: nameAnchor } = removeVariableFromBodyWithAnchor(body, 'name')!
      const { body: withoutBoth, anchor: priceAnchor } = removeVariableFromBodyWithAnchor(
        withoutName,
        'price',
      )!
      const withName = reinsertTokenInBody(withoutBoth, 'name', nameAnchor)
      expect(withName).toBe('Hi {{Name}}, price here')
      const withBoth = reinsertTokenInBody(withName, 'price', priceAnchor)
      expect(withBoth).toBe(body)
    })
  })
})
