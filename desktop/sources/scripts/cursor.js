'use strict'

function Cursor (client) {
  this.x = 0
  this.y = 0
  this.w = 0
  this.h = 0

  this.minX = 0
  this.maxX = 0
  this.minY = 0
  this.maxY = 0

  this.ins = false
  this.pinch = null
  this.wheelZoomAccum = 0
  this.wheelScrollTime = 0

  this.start = () => {
    document.onmousedown = this.onMouseDown
    document.onmouseup = this.onMouseUp
    document.onmousemove = this.onMouseMove
    document.oncopy = this.onCopy
    document.oncut = this.onCut
    document.onpaste = this.onPaste
    document.oncontextmenu = this.onContextMenu
    // passive:false is required to allow preventDefault() on touchmove,
    // which prevents the browser's native pinch-to-zoom from interfering.
    document.addEventListener('touchstart', this.onTouchStart, { passive: false })
    document.addEventListener('touchmove', this.onTouchMove, { passive: false })
    document.addEventListener('touchend', this.onTouchEnd, { passive: false })
    document.addEventListener('touchcancel', this.onTouchEnd, { passive: false })
    document.addEventListener('wheel', this.onWheel, { passive: false })
  }

  this.select = (x = this.x, y = this.y, w = this.w, h = this.h) => {
    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) { return }
    const rect = { x: clamp(parseInt(x), 0, client.orca.w - 1), y: clamp(parseInt(y), 0, client.orca.h - 1), w: clamp(parseInt(w), -this.x, client.orca.w - 1), h: clamp(parseInt(h), -this.y, client.orca.h - 1) }

    if (this.x === rect.x && this.y === rect.y && this.w === rect.w && this.h === rect.h) {
      return // Don't update when unchanged
    }

    this.x = rect.x
    this.y = rect.y
    this.w = rect.w
    this.h = rect.h
    this.calculateBounds()
    client.toggleGuide(false)
    client.update()
  }

  this.selectAll = () => {
    this.select(0, 0, client.orca.w, client.orca.h)
    this.ins = false
  }

  this.move = (x, y) => {
    this.select(this.x + parseInt(x), this.y - parseInt(y))
  }

  this.moveTo = (x, y) => {
    this.select(x, y)
  }

  this.scale = (w, h) => {
    this.select(this.x, this.y, this.w + parseInt(w), this.h - parseInt(h))
  }

  this.scaleTo = (w, h) => {
    this.select(this.x, this.y, w, h)
  }

  this.drag = (x, y) => {
    if (isNaN(x) || isNaN(y)) { return }
    this.ins = false
    const block = this.selection()
    this.erase()
    this.move(x, y)
    client.orca.writeBlock(this.minX, this.minY, block)
    client.history.record(client.orca.s)
  }

  this.reset = (pos = false) => {
    this.select(pos ? 0 : this.x, pos ? 0 : this.y, 0, 0)
    this.ins = 0
  }

  this.read = () => {
    return client.orca.glyphAt(this.x, this.y)
  }

  this.write = (g) => {
    if (!client.orca.isAllowed(g)) { return }
    if (client.orca.write(this.x, this.y, g) && this.ins) {
      this.move(1, 0)
    }
    client.history.record(client.orca.s)
  }

  this.erase = () => {
    for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
        client.orca.write(x, y, '.')
      }
    }
    client.history.record(client.orca.s)
  }

  this.find = (str) => {
    const i = client.orca.s.indexOf(str)
    if (i < 0) { return }
    const pos = client.orca.posAt(i)
    this.select(pos.x, pos.y, str.length - 1, 0)
  }

  this.inspect = () => {
    if (this.w !== 0 || this.h !== 0) { return 'multi' }
    const index = client.orca.indexAt(this.x, this.y)
    const port = client.ports[index]
    if (port) { return `${port[3]}` }
    if (client.orca.lockAt(this.x, this.y)) { return 'locked' }
    return 'empty'
  }

  this.trigger = () => {
    const operator = client.orca.operatorAt(this.x, this.y)
    if (!operator) { console.warn('Cursor', 'Nothing to trigger.'); return }
    console.log('Cursor', 'Trigger: ' + operator.name)
    operator.run(true)
  }

  this.comment = () => {
    const block = this.selection()
    const lines = block.trim().split(/\r?\n/)
    const char = block.substr(0, 1) === '#' ? '.' : '#'
    const res = lines.map((line) => { return `${char}${line.substr(1, line.length - 2)}${char}` }).join('\n')
    client.orca.writeBlock(this.minX, this.minY, res)
    client.history.record(client.orca.s)
  }

  this.toUpperCase = () => {
    const block = this.selection().toUpperCase()
    client.orca.writeBlock(this.minX, this.minY, block)
  }

  this.toLowerCase = () => {
    const block = this.selection().toLowerCase()
    client.orca.writeBlock(this.minX, this.minY, block)
  }

  this.toRect = () => {
    return {
      x: this.minX,
      y: this.minY,
      w: this.maxX - this.minX + 1,
      h: this.maxY - this.minY + 1
    }
  }

  this.calculateBounds = () => {
    this.minX = this.x < this.x + this.w ? this.x : this.x + this.w
    this.minY = this.y < this.y + this.h ? this.y : this.y + this.h
    this.maxX = this.x > this.x + this.w ? this.x : this.x + this.w
    this.maxY = this.y > this.y + this.h ? this.y : this.y + this.h
  }

  this.selected = (x, y, w = 0, h = 0) => {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY
  }

  this.selection = (rect = this.toRect()) => {
    return client.orca.getBlock(rect.x, rect.y, rect.w, rect.h)
  }

  this.mouseFrom = null

  this.onTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const c = this.getTouchCentroid(e)
      // mode: null = undecided, 'zoom', 'pan'
      this.pinch = { dist: this.getTouchDist(e), cx: c.x, cy: c.y, panX: 0, panY: 0, mode: null }
    }
  }

  this.onTouchMove = (e) => {
    if (e.touches.length !== 2 || !this.pinch) { return }
    e.preventDefault()

    const dist = this.getTouchDist(e)
    const c = this.getTouchCentroid(e)
    const distDelta = Math.abs(dist - this.pinch.dist)
    const panDelta = Math.hypot(c.x - this.pinch.cx, c.y - this.pinch.cy)

    // Lock gesture mode on first significant movement
    if (!this.pinch.mode) {
      if (distDelta >= 10) { this.pinch.mode = 'zoom' } else if (panDelta >= 8) { this.pinch.mode = 'pan' }
    }

    if (this.pinch.mode === 'zoom') {
      const delta = dist - this.pinch.dist
      if (Math.abs(delta) >= 10) {
        client.modZoom(delta > 0 ? 0.0625 : -0.0625)
        this.pinch.dist = dist
      }
    } else if (this.pinch.mode === 'pan') {
      // Accumulate centroid movement into whole tile steps
      this.pinch.panX += (this.pinch.cx - c.x) / client.tile.w
      this.pinch.panY += (this.pinch.cy - c.y) / client.tile.h
      const dx = Math.trunc(this.pinch.panX)
      const dy = Math.trunc(this.pinch.panY)
      if (dx !== 0 || dy !== 0) {
        client.modViewport(dx, dy)
        this.pinch.panX -= dx
        this.pinch.panY -= dy
      }
    }

    this.pinch.cx = c.x
    this.pinch.cy = c.y
  }

  this.onTouchEnd = (e) => {
    if (e.touches.length < 2) { this.pinch = null }
  }

  this.getTouchDist = (e) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    return Math.hypot(dx, dy)
  }

  this.getTouchCentroid = (e) => {
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    }
  }

  this.onWheel = (e) => {
    e.preventDefault()
    if (e.ctrlKey) {
      // Trackpad pinch: browser sets ctrlKey and puts the pinch delta in deltaY
      this.wheelZoomAccum -= e.deltaY
      if (Math.abs(this.wheelZoomAccum) >= 20) {
        client.modZoom(this.wheelZoomAccum > 0 ? 0.0625 : -0.0625)
        this.wheelZoomAccum = 0
      }
    } else {
      // Scroll: throttle to prevent trackpad momentum from firing many cells at once
      const now = performance.now()
      if (now - this.wheelScrollTime < 80) { return }
      this.wheelScrollTime = now
      const dx = e.shiftKey ? Math.sign(e.deltaY) : Math.sign(e.deltaX)
      const dy = e.shiftKey ? 0 : Math.sign(e.deltaY)
      client.modViewport(dx, dy)
    }
  }

  this.onMouseDown = (e) => {
    if (e.button !== 0) { this.cut(); return }
    const pos = this.mousePick(e.clientX, e.clientY)
    this.select(pos.x, pos.y, 0, 0)
    this.mouseFrom = pos
  }

  this.onMouseMove = (e) => {
    if (!this.mouseFrom) { return }
    const pos = this.mousePick(e.clientX, e.clientY)
    this.select(this.mouseFrom.x, this.mouseFrom.y, pos.x - this.mouseFrom.x, pos.y - this.mouseFrom.y)
  }

  this.onMouseUp = (e) => {
    if (this.mouseFrom) {
      const pos = this.mousePick(e.clientX, e.clientY)
      this.select(this.mouseFrom.x, this.mouseFrom.y, pos.x - this.mouseFrom.x, pos.y - this.mouseFrom.y)
    }
    this.mouseFrom = null
  }

  this.mousePick = (x, y, w = client.tile.w, h = client.tile.h) => {
    return {
      x: parseInt((x - 30) / w) + client.viewport.x,
      y: parseInt((y - 30) / h) + client.viewport.y
    }
  }

  this.onContextMenu = (e) => {
    e.preventDefault()
  }

  this.copy = function () {
    document.execCommand('copy')
  }

  this.cut = function () {
    document.execCommand('cut')
  }

  this.paste = function (overlap = false) {
    document.execCommand('paste')
  }

  this.onCopy = (e) => {
    e.clipboardData.setData('text/plain', this.selection())
    e.preventDefault()
  }

  this.onCut = (e) => {
    this.onCopy(e)
    this.erase()
  }

  this.onPaste = (e) => {
    const data = e.clipboardData.getData('text/plain').trim()
    client.orca.writeBlock(this.minX, this.minY, data, this.ins)
    client.history.record(client.orca.s)
    this.scaleTo(data.split(/\r?\n/)[0].length - 1, data.split(/\r?\n/).length - 1)
    e.preventDefault()
  }

  function clamp (v, min, max) { return v < min ? min : v > max ? max : v }
}
