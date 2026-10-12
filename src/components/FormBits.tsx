import type { ReactNode } from 'react'

export function Field({ label, required, hint, error, children, id }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return <div className={`field ${error ? 'has-error' : ''}`} id={id}><label>{label}{required && <span className="required">（必填）</span>}{children}</label>{hint && <p className="hint">{hint}</p>}{error && <p className="field-error" role="alert">⚠ {error}</p>}</div>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'error' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
