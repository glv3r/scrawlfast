import { Component, ElementRef, NgZone, inject, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

type Point = {
  x: number,
  y: number
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
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
    
    if (!this.isDrawing() || !this.lastPoint || !this.ctx || !canvas) return;

    // Track where our pointer is now
    const current = this.getCanvasPoint(canvas, event)
    if (!current) return;
    
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y) // move to our last point
    this.ctx.lineTo(current.x, current.y) // draw to our current point
    this.ctx.stroke()

    this.lastPoint = current; // now the new becomes old for the next event

    this.currentStroke?.push(current) // record what was just drawn
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
  }
  
    

  ngAfterViewInit(): void {
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
    this.redrawAll()
  }

  clear() {
    this.strokes = []
    this.redrawAll()
  }

  // Co-ordinate conversion for both event listeners
  getCanvasPoint(c: HTMLCanvasElement, event: PointerEvent): { x: number, y: number } | null {
    const rect = c.getBoundingClientRect()
  
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    return {x, y}
  }

  //Clears canvas and re-draws all strokes
  redrawAll() {
    const c = this.drawCanvas()?.nativeElement
    if (!c) return;
    
    console.log("Redrawing.....")
    // Clear canvas and redraw
    this.ctx?.clearRect(0, 0, c.width / this.dpr, c.height / this.dpr)
    
    this.strokes.forEach((s) => {
      if (s.length < 2) return; // skip strokes with less than 2 points
      
      this.ctx?.beginPath()
      this.ctx?.moveTo(s[0].x, s[0].y)

      for (let i = 1; i < s.length; i++){
        this.ctx?.lineTo(s[i].x, s[i].y)   
      }

      this.ctx?.stroke()
    })
  }

}
