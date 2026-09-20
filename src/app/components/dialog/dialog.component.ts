import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-dialog',
  imports: [CommonModule],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css'
})
export class DialogComponent {
  isOpen: boolean = false;
  @ViewChild('dialog', { static: false }) DialogRef!: ElementRef;
  onTouched = () => {};

  @Input()
  get open(): boolean { return this.isOpen; }
  set open(v: boolean) {
    const next = !!v;
    if (next === this.isOpen) return;
    next ? this.openDialog() : this.closeDialog();
  }

  @Output() openChange = new EventEmitter<boolean>();

  @HostListener('document:keydown.escape')
  onEsc() { this.closeDialog(); }

  private lockScroll(lock: boolean) {
    document.body.style.overflow = lock ? 'hidden' : '';
  }


  // animateDialog(state: string) {
  //   const element = this.DialogRef?.nativeElement;
  //   if (!element) return;

  //   switch (state) {
  //     case 'open':
  //       // Element already starts at translateY(100%) from CSS
  //       gsap.fromTo(
  //         element,
  //         { y: '100%' },
  //         {
  //           y: 0, // Animate to final position
  //           duration: 0.25,
  //           ease: 'power3.out',
  //           onStart: () => this.lockScroll(true)
  //         }
  //       );
  //       break;
  //     case 'close':
  //       gsap.to(element, {
  //         y: '100%', // Animate back down
  //         duration: 0.3,
  //         ease: 'power3.in',
  //         onComplete: () => {
  //           this.isOpen = false;
  //           this.lockScroll(false);
  //           this.openChange.emit(false);
  //         },
  //       });
  //       break;
  //   }
  // }

  // ...existing code...
animateDialog(state: string) {
  const element = this.DialogRef?.nativeElement;
  const backdrop = element?.previousElementSibling; // backdrop element
  if (!element) return;

  switch (state) {
    case 'open':
      // shadcn style: fade + scale up from center
      gsap.set(element, { scale: 0.95, opacity: 0 });
      gsap.set(backdrop, { opacity: 0 });
      
      gsap.to(backdrop, {
        opacity: 1,
        duration: 0.15,
        ease: 'power2.out'
      });
      
      gsap.to(element, {
        scale: 1,
        opacity: 1,
        duration: 0.15,
        ease: 'power2.out',
        onStart: () => this.lockScroll(true)
      });
      break;
      
    case 'close':
      // shadcn style: fade + scale down to center
      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in'
      });
      
      gsap.to(element, {
        scale: 0.95,
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
        onComplete: () => {
          this.isOpen = false;
          this.lockScroll(false);
          this.openChange.emit(false);
        }
      });
      break;
  }
}

  openDialog() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.openChange.emit(true); // notify parent immediately

    // Wait for *ngIf to render the element, then animate
    requestAnimationFrame(() => {
      const element = this.DialogRef?.nativeElement;
      if (element) {
        gsap.killTweensOf(element);
        this.animateDialog('open');
      }
    });
  }

  toggleDialog() {
    this.isOpen ? this.closeDialog() : this.openDialog();
  }

  closeDialog() {
    if (!this.isOpen) return;
     const element = this.DialogRef?.nativeElement;
    if (element) {
      gsap.killTweensOf(element);
      this.animateDialog('close');
    }else {
      // Fallback if element already gone
      this.isOpen = false;
      this.lockScroll(false);
      this.openChange.emit(false);
    }
    this.onTouched();
  }

}
