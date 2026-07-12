import { CommonModule } from '@angular/common';
import { Component, ElementRef, NgZone, inject, signal, viewChild, effect, computed } from '@angular/core';

type Point = {
  x: number,
  y: number
}

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'signing-tool';
  observer: ResizeObserver | null = null;
  zone = inject(NgZone)
  isDrawing = signal(false);
  drawCanvas = viewChild<ElementRef<HTMLCanvasElement>>('drawingCanvas');
  ctx: CanvasRenderingContext2D | null = null;
  dpr = window.devicePixelRatio // Get the dpr for the current device (ratio of screen pixels to CSS pixels)
  lastPoint: Point | null = null

  point: Point | null = null
  stroke: Point[] | null = null
  strokes: Point[][] = []
  currentStroke: Point[] | null = null

  strokeWidth = signal<number>(2)
  strokeColor = signal<string>("#000")
  rotationAngle = signal<number>(0)

  swatches = ["#1F1E1B", "#2743B8", "#8E2A22"]

  fillPercent = computed(() => {
    const min = 1, max = 12;
    return `${((this.strokeWidth() - min) / (max - min)) * 100}%`;
  });

  rotationPercent = computed(() => {
    const min = -20, max = 20;
    return `${((this.rotationAngle() - min) / (max - min)) * 100}%`;
  })

  selectColor(c: string) {
    this.strokeColor.set(c)
  }

  constructor() {
    effect(() => {
      // Explicitly call the deps at the top so they're not hidden
      // from the early return in the redrawAll method
      this.strokeWidth();
      this.strokeColor();
      this.rotationAngle();
      this.redrawAll()
    });
  }

  // --------- Event Listeners ------------
  
  // pointerdown
  onPointerDown(event: PointerEvent) {
    const canvas = this.drawCanvas()?.nativeElement
    if (!canvas) return;
    
    console.log("Pointer down event: ", event.pointerType)
    canvas.setPointerCapture(event.pointerId)

    this.isDrawing.set(true)

    // Record last point    
    this.lastPoint = this.getCanvasPoint(canvas, event)
    if (!this.lastPoint) return;
    this.currentStroke = [this.lastPoint]
    
  }

  // pointermove
  onPointerMove(event: PointerEvent) {
    const canvas = this.drawCanvas()?.nativeElement
    
    if (!this.isDrawing() || !this.lastPoint || !canvas) return;

    // Track where our pointer is now
    const current = this.getCanvasPoint(canvas, event)
    if (!current) return;
    

    this.currentStroke?.push(current) // record what was just drawn

    this.redrawAll()

    this.renderStroke(this.currentStroke)
  }

  // pointerup 
  onPointerUp(event: PointerEvent) { 
    console.log("Pointer up event: ", event.pointerType)
    this.isDrawing.set(false)
    this.lastPoint = null

    if (this.currentStroke && this.currentStroke.length > 0) {
      this.strokes.push(this.currentStroke)
    }

    this.currentStroke = null
    const payload = {
      "strokes": this.strokes,
      "angle": this.rotationAngle(),
      "strokeWidth": this.strokeWidth(),
      "ink": this.strokeColor()
    }
    
    localStorage.setItem('stroke-payload', JSON.stringify(payload))
  }
  
    

  ngAfterViewInit(): void {
    this.restoreStrokes()
    
    const canvas = this.drawCanvas()?.nativeElement
    if (!canvas) return;

    // We're avoiding change detection from running on every pointer move detected
    // (since nothing in the template depends on the canvas for updates). We're also setting
    // the listeners on the canvas only so that drawing happens only in the canvas, and nowhere else
    this.zone.runOutsideAngular(() => {
        canvas.addEventListener('pointerdown', e => this.onPointerDown(e))
        canvas.addEventListener('pointermove', e => this.onPointerMove(e))
        canvas.addEventListener('pointerup', e => this.onPointerUp(e))
        canvas.addEventListener('pointercancel', e => this.onPointerUp(e))
    })

    this.ctx = canvas.getContext('2d')

    // Get the size the canvas displays at in CSS pixels
    const rect = canvas.getBoundingClientRect();
    console.log(rect)

    this.resizeCanvas(canvas)

    this.observer = new ResizeObserver((entries) => {
      this.resizeCanvas(canvas)
    })

    this.observer.observe(canvas)
  }

  ngOnDestroy(): void {
    this.observer?.disconnect()
  }


  resizeCanvas(c: HTMLCanvasElement) {
    // Read the rect from the resized canvas again
    const rect = c.getBoundingClientRect()

    
    // Set bitmap (to scale well and sharpen)
    c.width = Math.round(rect.width * this.dpr)
    c.height = Math.round(rect.height * this.dpr)

    // We scale the context so drawing at 1 CSS pixel draws at 1 physical pixel
    if (!this.ctx) return; 
    
    this.ctx.scale(this.dpr, this.dpr)
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.redrawAll()
  }

  undo() {
    this.strokes.pop()
    const payload = {
      "strokes": this.strokes,
      "angle": this.rotationAngle(),
      "strokeWidth": this.strokeWidth(),
      "ink": this.strokeColor()
    }
    localStorage.setItem('stroke-payload', JSON.stringify(payload))
    this.redrawAll()
  }

  clear() {
    this.strokes = []
    localStorage.removeItem('stroke-payload')
    this.redrawAll()
  }

  // Co-ordinate conversion for both event listeners
  getCanvasPoint(c: HTMLCanvasElement, event: PointerEvent): { x: number, y: number } | null {
    const rect = c.getBoundingClientRect()
  
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    return {x, y}
  }

  // Clears canvas and re-draws all strokes
  redrawAll() {
    const c = this.drawCanvas()?.nativeElement
    if (!c) return;
    
    console.log("Redrawing.....")
    // Clear canvas and redraw

    if (!this.ctx) return;
    this.ctx?.clearRect(0, 0, c.width / this.dpr, c.height / this.dpr)
    this.ctx.lineWidth = this.strokeWidth()
    this.ctx.strokeStyle = this.strokeColor()

    this.ctx.save()

    const bbox = this.getBoundingBox()
    if (this.rotationAngle() !== 0 && bbox) {
      let cx = (bbox.minX + bbox.maxX) / 2
      let cy = (bbox.minY + bbox.maxY) / 2
      this.ctx.translate(cx, cy)
      this.ctx.rotate(this.rotationAngle() * Math.PI / 180)
      this.ctx.translate(-cx, -cy)
    }
    
    this.strokes.forEach((s) => {
      this.renderStroke(s)
    })

    this.ctx.restore()
  }


  renderStroke(s: Point[] | null) {
    if (!this.ctx || !s) return;
    if (s.length < 2) return; // skip strokes with less than 2 points
    
    this.ctx.beginPath()
    this.ctx.moveTo(s[0].x, s[0].y)

    // Smoothening curves so the drawing feels much more natural (we're eliminating
    // polygon-type edges here)
    for (let i = 1; i < s.length - 1; i++){
      let midX = (s[i].x + s[i+1].x) / 2
      let midY = (s[i].y + s[i + 1].y) / 2
      this.ctx.quadraticCurveTo(s[i].x, s[i].y, midX, midY)
    }
    
    this.ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y)   
    this.ctx.stroke()
  }

  // Restore strokes (if any) from localStorage
  restoreStrokes() {
    const s = localStorage.getItem('stroke-payload')
    if (!s) return;
    try {
      let sParsed = JSON.parse(s)
      this.strokes = sParsed.strokes
      this.strokeWidth.set(sParsed.strokeWidth)
      this.rotationAngle.set(sParsed.angle)
      this.strokeColor.set(sParsed.ink)
      console.log("parsed: ", sParsed)
      
    } catch (err) {
      console.error("Unable to parse strokes from localStorage: ", err)
    }
  }




  // ----------- Helper functions ---------------


  getBoundingBox(): { minX: number, minY: number, maxX: number, maxY: number } | null {
    if (this.strokes.length === 0) return null;
  
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
  
    for (const stroke of this.strokes) {
      for (const p of stroke) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
  
    return { minX, minY, maxX, maxY };
  }



}
