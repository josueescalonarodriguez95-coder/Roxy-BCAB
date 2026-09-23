/**
 * Touch feedback: a soft pastel wave that grows from where you tap/click on buttons, cards and
 * table rows. One listener for the whole app, so screens don't need to know about it.
 */
const TARGETS = 'button, .clickable td, .person-card, .stat, .chip'

export function installRipple(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  document.addEventListener('pointerdown', (e) => {
    const target = e.target instanceof Element ? e.target : null
    // Rows: the wave goes in the cell that was touched and the whole row flashes.
    const host = target?.closest<HTMLElement>(TARGETS)
    if (!host || (host as HTMLButtonElement).disabled) return
    const rect = host.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const wave = document.createElement('span')
    wave.className = 'ripple-wave'
    wave.style.width = wave.style.height = `${size}px`
    wave.style.left = `${e.clientX - rect.left - size / 2}px`
    wave.style.top = `${e.clientY - rect.top - size / 2}px`
    host.classList.add('ripple-host')
    host.appendChild(wave)
    wave.addEventListener('animationend', () => wave.remove())

    const row = host.closest('tr.clickable')
    if (row) {
      row.classList.remove('row-flash')
      // Force a reflow so the animation restarts on repeated taps.
      void (row as HTMLElement).offsetWidth
      row.classList.add('row-flash')
    }
  })
}
