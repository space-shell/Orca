'use strict'

function Picker (client) {
  this.el = null
  this.isVisible = false
  this.shift = false

  const glyphs = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z',
    '.', '*', '#', ':', '%', '!', '?', ';', '=', '$'
  ]

  this.install = (host) => {
    // Main picker panel
    this.el = document.createElement('div')
    this.el.id = 'picker'

    // Tab bar
    const tabs = document.createElement('div')
    tabs.className = 'picker-tabs'

    const glyphsTab = document.createElement('button')
    glyphsTab.className = 'picker-tab active'
    glyphsTab.textContent = 'Glyphs'
    glyphsTab.dataset.tab = 'glyphs'

    const actionsTab = document.createElement('button')
    actionsTab.className = 'picker-tab'
    actionsTab.textContent = 'Actions'
    actionsTab.dataset.tab = 'actions'

    tabs.appendChild(glyphsTab)
    tabs.appendChild(actionsTab)
    this.el.appendChild(tabs)

    // Glyphs panel
    const glyphsPanel = document.createElement('div')
    glyphsPanel.className = 'picker-panel'
    glyphsPanel.id = 'picker-panel-glyphs'

    const glyphGrid = document.createElement('div')
    glyphGrid.className = 'picker-glyphs'
    this._buildGlyphGrid(glyphGrid, glyphs)
    glyphsPanel.appendChild(glyphGrid)

    // Shift toggle button
    const shiftBtn = document.createElement('button')
    shiftBtn.className = 'picker-glyph picker-shift-btn'
    shiftBtn.id = 'picker-shift-btn'
    shiftBtn.textContent = 'A/a'
    shiftBtn.addEventListener('click', () => {
      this.shift = !this.shift
      shiftBtn.classList.toggle('active', this.shift)
      this._buildGlyphGrid(glyphGrid, glyphs)
    })
    glyphsPanel.appendChild(shiftBtn)
    this.el.appendChild(glyphsPanel)

    // Actions panel
    const actionsPanel = document.createElement('div')
    actionsPanel.className = 'picker-panel'
    actionsPanel.id = 'picker-panel-actions'
    actionsPanel.style.display = 'none'

    const row1 = document.createElement('div')
    row1.className = 'picker-action-row'
    row1.appendChild(this._makeActionBtn('▶ Play', () => { client.commander.trigger('play') }))
    row1.appendChild(this._makeActionBtn('■ Stop', () => { client.commander.trigger('stop') }))
    row1.appendChild(this._makeActionBtn('→ Step', () => { client.commander.trigger('run') }))
    actionsPanel.appendChild(row1)

    const row2 = document.createElement('div')
    row2.className = 'picker-action-row'
    row2.appendChild(this._makeActionBtn('BPM−10', () => { client.commander.trigger('bpm:' + (client.clock.speed.value - 10)) }))
    row2.appendChild(this._makeActionBtn('BPM−1', () => { client.commander.trigger('bpm:' + (client.clock.speed.value - 1)) }))
    const bpmLabel = document.createElement('span')
    bpmLabel.className = 'picker-bpm-label'
    bpmLabel.id = 'picker-bpm-label'
    bpmLabel.textContent = '120 bpm'
    row2.appendChild(bpmLabel)
    row2.appendChild(this._makeActionBtn('BPM+1', () => { client.commander.trigger('bpm:' + (client.clock.speed.value + 1)) }))
    row2.appendChild(this._makeActionBtn('BPM+10', () => { client.commander.trigger('bpm:' + (client.clock.speed.value + 10)) }))
    actionsPanel.appendChild(row2)

    const row3 = document.createElement('div')
    row3.className = 'picker-action-row'
    row3.appendChild(this._makeActionBtn('⌫ Erase', () => { client.cursor.erase() }))
    row3.appendChild(this._makeActionBtn('⎘ Copy', () => { client.cursor.copy() }))
    row3.appendChild(this._makeActionBtn('⎘ Paste', () => { client.cursor.paste() }))
    actionsPanel.appendChild(row3)

    this.el.appendChild(actionsPanel)

    // Tab switching
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.picker-tab')
      if (!tab) { return }
      tabs.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      glyphsPanel.style.display = tab.dataset.tab === 'glyphs' ? '' : 'none'
      actionsPanel.style.display = tab.dataset.tab === 'actions' ? '' : 'none'
    })

    // Close on outside tap/click
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.el.contains(e.target)) { this.close() }
    })

    host.appendChild(this.el)
  }

  this._buildGlyphGrid = (container, glyphs) => {
    container.innerHTML = ''
    for (const g of glyphs) {
      const btn = document.createElement('button')
      btn.className = 'picker-glyph'
      btn.textContent = this.shift ? g.toUpperCase() : g
      btn.addEventListener('click', () => {
        client.cursor.write(this.shift ? g.toUpperCase() : g)
      })
      container.appendChild(btn)
    }
    // Fill remainder of last row so teal grid background doesn't bleed through
    const rem = glyphs.length % 10
    if (rem !== 0) {
      for (let i = rem; i < 10; i++) {
        const filler = document.createElement('div')
        filler.className = 'picker-glyph-filler'
        container.appendChild(filler)
      }
    }
  }

  this._makeActionBtn = (label, handler) => {
    const btn = document.createElement('button')
    btn.className = 'picker-action-btn'
    btn.textContent = label
    btn.addEventListener('click', handler)
    return btn
  }

  this.open = () => {
    const bpmLabel = document.getElementById('picker-bpm-label')
    if (bpmLabel) { bpmLabel.textContent = client.clock.speed.value + ' bpm' }
    this.el.classList.add('visible')
    this.isVisible = true
  }

  this.close = () => {
    this.el.classList.remove('visible')
    this.isVisible = false
  }

  this.toggle = () => {
    if (this.isVisible) { this.close() } else { this.open() }
  }
}
