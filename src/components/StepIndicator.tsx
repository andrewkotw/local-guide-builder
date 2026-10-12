import { STEPS } from '../data'

export function StepIndicator({ current, onSelect }: { current: number; onSelect: (step: number) => void }) {
  return <nav className="steps" aria-label="製作步驟">
    <ol>{STEPS.map((label, index) => <li key={label} className={index === current ? 'active' : index < current ? 'done' : ''}><button type="button" onClick={() => onSelect(index)} aria-current={index === current ? 'step' : undefined}><span>{index < current ? '完成' : index + 1}</span><b>{label}</b></button></li>)}</ol>
    <label className="mobile-step-select"><span>目前是第 {current + 1} 步，共 5 步</span><select aria-label="前往其他步驟" value={current} onChange={(event) => onSelect(Number(event.target.value))}>{STEPS.map((label, index) => <option value={index} key={label}>{index + 1}. {label}</option>)}</select></label>
  </nav>
}
