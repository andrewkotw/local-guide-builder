import type { ProjectData } from '../types'
import { escapeHtml } from './security'

function body(text: string, language: string): string {
  if (!text.trim()) return ''
  return `<div lang="${language}" data-visit-language="${language}">${text.split(/\n+/).filter((line) => line.trim()).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`
}

/** Pretranslated content: the exported site never needs an AI API or a connection. */
export function visitNotesHtml(project: ProjectData): string {
  const blocks = [
    { kind: 'note', heading: '我們推薦的原因', headingEn: 'Why We Recommend It', zh: project.recommendation, en: project.recommendationEn ?? '' },
    { kind: 'notice', heading: '參觀提醒', headingEn: 'Visitor Tips', zh: project.notice, en: project.noticeEn ?? '' },
  ].filter((block) => block.zh.trim() || block.en.trim())
  if (!blocks.length) return ''
  const canSwitch = blocks.every((block) => block.zh.trim() && block.en.trim())
  const toggle = canSwitch ? `<div class="visit-language-tools" hidden style="display:none" data-visit-tools><p>以下兩段可切換語言 · Switch the two sections below</p><button type="button" class="visit-language-button" data-visit-toggle aria-controls="visit-notes-content" aria-pressed="false" style="font:inherit;min-height:44px;padding:.7em 1em;cursor:pointer;background:var(--accent,#28744d);color:#fff;border:0;border-radius:8px">翻譯蒟蒻 · Read in English</button></div>` : ''
  return `<div id="visit-notes">${toggle}<div id="visit-notes-content">${blocks.map((block) => `<div class="${block.kind}"><h3>${block.heading}<br><small lang="en">${block.headingEn}</small></h3>${body(block.zh, 'zh-Hant')}${body(block.en, 'en')}</div>`).join('')}</div></div>`
}

// Keep student input out of executable code. Use both hidden and inline display to
// preserve switching even when an uploaded full stylesheet sets div {display:...}.
export const VISIT_NOTES_SCRIPT = `;(()=>{
  const root=document.querySelector('#visit-notes');
  const button=root?.querySelector('[data-visit-toggle]');
  const toolbar=root?.querySelector('[data-visit-tools]');
  if(!button||!toolbar)return;
  let english=false;
  const render=()=>{
    root.querySelectorAll('[data-visit-language]').forEach((element)=>{
      const show=element.dataset.visitLanguage===(english?'en':'zh-Hant');
      element.hidden=!show;
      if(show)element.style.removeProperty('display');
      else element.style.setProperty('display','none','important');
    });
    button.textContent=english?'顯示中文 · Read in Chinese':'翻譯蒟蒻 · Read in English';
    button.setAttribute('aria-pressed',String(english));
  };
  button.addEventListener('click',()=>{english=!english;render()});
  render();toolbar.hidden=false;toolbar.style.removeProperty('display');
})()`

export const VISIT_NOTES_CSS = `.visit-language-tools{margin-top:2rem}.visit-language-tools p{color:var(--muted);font-size:1rem}.note h3 small,.notice h3 small{font-size:.8em;font-weight:600;color:var(--muted)}.note h3,.notice h3{line-height:1.6}.visit-language-button:hover{filter:brightness(.9)}`
