import { useState } from 'react'
import { api } from '../api'
import { emptyForm, formToItem, isFilled, itemToForm } from '../lib/formValues'
import { Field } from './fields'

// Create (item = null) or edit one item of a section
export default function ItemForm({ section, item, onSaved, onCancel, onError }) {
  const [form, setForm] = useState(() => (item ? itemToForm(section.fields, item) : emptyForm(section.fields)))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploads, setUploads] = useState(0) // uploads still in progress
  const [relogin, setRelogin] = useState(false) // session expired mid-edit
  const [password, setPassword] = useState('')

  // Accepts a value or an updater (prev → next), like setState
  const set = (name) => (value) =>
    setForm((f) => ({ ...f, [name]: typeof value === 'function' ? value(f[name]) : value }))
  const onUploading = (delta) => setUploads((n) => n + delta)

  const save = async () => {
    const missing = section.fields.filter((f) => f.required && !isFilled(f, form[f.name]))
    if (missing.length) return setMessage(`Please fill in: ${missing.map((f) => f.label).join(', ')}`)

    setSaving(true)
    setMessage('')
    try {
      const data = formToItem(section.fields, form)
      if (item) await api.update(section.key, item._id, { ...data, slug: item.slug, order: item.order })
      else await api.create(section.key, data)
      onSaved()
    } catch (err) {
      setSaving(false)
      // Expired login: ask for the password here so the edits on screen aren't lost
      if (err.status === 401) {
        setRelogin(true)
        return setMessage('Your login expired. Enter your password to save your changes.')
      }
      onError(err)
      setMessage(err.message)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!uploads) save()
  }

  const loginAndSave = async () => {
    try {
      await api.login(password)
      setRelogin(false)
      setPassword('')
      await save()
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <form onSubmit={onSubmit} className="nb-box p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="m-0 font-display font-bold uppercase text-[28px] leading-none">
          {item ? `Edit ${section.noun}` : `New ${section.noun}`}
        </h2>
        {item?.slug && <span className="nb-chip bg-(--color-sunken)">/{item.slug}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
        {section.fields.map((field) => (
          <Field key={field.name} field={field} value={form[field.name]} onChange={set(field.name)} onUploading={onUploading} />
        ))}
      </div>

      {message && <p className="mt-6 mb-0 font-semibold text-(--color-red)">{message}</p>}
      {relogin && (
        <div className="flex flex-wrap gap-3 mt-4">
          <input
            type="password"
            className="nb-input flex-1 min-w-[200px]"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                loginAndSave()
              }
            }}
            autoFocus
          />
          <button type="button" className="nb-btn nb-btn-yellow nb-press" onClick={loginAndSave} disabled={!password}>
            Log in &amp; save
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t-[3px] border-(--color-ink)">
        <button type="submit" className="nb-btn nb-btn-yellow nb-press" disabled={saving || uploads > 0 || relogin}>
          {uploads > 0 ? 'Waiting for upload…' : saving ? 'Saving…' : item ? 'Save changes' : `Add ${section.noun}`}
        </button>
        <button type="button" className="nb-btn nb-press" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
