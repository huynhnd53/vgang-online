function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface PromptPart {
  key?: string;
  text: string;
}

export class Hud {
  readonly money = $('money');
  readonly where = $('where');
  readonly shift = $('shift');
  readonly objective = $('objective');
  readonly crosshair = $('crosshair');
  readonly prompt = $('prompt');
  readonly toasts = $('toasts');
  readonly lockHint = $('lock-hint');
  readonly rotateHint = $('rotate-hint');
  readonly touch = $('touch');
  readonly joystick = $('joystick');
  readonly joystickKnob = $('joystick-knob');
  readonly tInteract = $('t-interact') as HTMLButtonElement;
  readonly tRotate = $('t-rotate') as HTMLButtonElement;
  readonly tCancel = $('t-cancel') as HTMLButtonElement;
  readonly btnCatalog = $('btn-catalog') as HTMLButtonElement;
  readonly btnInventory = $('btn-inventory') as HTMLButtonElement;
  readonly btnCamera = $('btn-camera') as HTMLButtonElement;
  readonly btnHelp = $('btn-help') as HTMLButtonElement;
  readonly panel = $('panel');
  readonly panelTitle = $('panel-title');
  readonly panelBody = $('panel-body');
  readonly panelClose = $('panel-close') as HTMLButtonElement;
  readonly fade = $('fade');

  private lastPrompt = '';
  private lastObjective = '';

  setText(el: HTMLElement, text: string): void {
    if (el.textContent !== text) el.textContent = text;
  }

  show(el: HTMLElement, visible: boolean): void {
    el.classList.toggle('hidden', !visible);
  }

  setPrompt(parts: PromptPart[] | null, showKeys: boolean): void {
    const html = parts
      ? parts
          .map((p) => (p.key && showKeys ? `<kbd>${escapeHtml(p.key)}</kbd>` : '') + escapeHtml(p.text))
          .join(' &nbsp;·&nbsp; ')
      : '';
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    this.prompt.innerHTML = html;
    this.show(this.prompt, html !== '');
  }

  setObjective(text: string | null): void {
    const t = text ?? '';
    if (t === this.lastObjective) return;
    this.lastObjective = t;
    this.objective.textContent = t;
    this.show(this.objective, t !== '');
  }

  toast(text: string, good = false): void {
    const el = document.createElement('div');
    el.className = good ? 'toast good' : 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => el.remove(), 3300);
  }

  openPanel(title: string, body: HTMLElement): void {
    this.panelTitle.textContent = title;
    this.panelBody.replaceChildren(body);
    this.show(this.panel, true);
  }

  closePanel(): void {
    this.show(this.panel, false);
    this.panelBody.replaceChildren();
  }

  get panelOpen(): boolean {
    return !this.panel.classList.contains('hidden');
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  for (const c of children) node.append(c);
  return node;
}
