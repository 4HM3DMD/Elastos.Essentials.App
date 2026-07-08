import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

const MIN_FONT_SIZE_PX = 14;
const SHRINK_STEP_PX = 2;
const HIDDEN_MASK = '••••••';
const ELLIPSIS = '…';
const BASE_FONT_SIZE_BY_SIZE: { [size: number]: number } = { 1: 18, 2: 28, 3: 36, 4: 46 };

/**
 * A large amount value with an optional unit and fiat sub-line. Steps its font
 * size down (2px per tier, to a floor) so long amounts fit their container, and
 * middle-ellipsizes the value if it still overflows at the smallest size (so the
 * magnitude and the last digits both stay visible). Can mask the value and fiat
 * behind a dot mask, and can render its own show/hide toggle.
 */
@Component({
  selector: 'ui-amount-display',
  templateUrl: './ui-amount-display.component.html',
  styleUrls: ['./ui-amount-display.component.scss']
})
export class UiAmountDisplayComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() public value = '';
  @Input() public unit: string = null;
  @Input() public fiat: string = null;
  @Input() public size: 1 | 2 | 3 | 4 = 3;
  @Input() public hidden = false;
  /** When true, renders an eye button that emits (toggleHidden). */
  @Input() public showToggle = false;
  @Input() public toggleLabel = 'Show or hide amount';

  @Output() public toggleHidden = new EventEmitter<void>();

  @ViewChild('valueEl') private valueEl: ElementRef<HTMLElement>;

  public readonly mask = HIDDEN_MASK;

  private pendingResize: ReturnType<typeof setTimeout> = null;

  constructor(private zone: NgZone) {}

  public ngAfterViewInit(): void {
    this.fit();
  }

  public ngOnChanges(): void {
    // Re-fit after the new value renders.
    this.scheduleFit();
  }

  public ngOnDestroy(): void {
    this.clearPendingResize();
  }

  public onToggleHidden(): void {
    this.toggleHidden.emit();
  }

  private scheduleFit(): void {
    this.clearPendingResize();
    // Run outside Angular so the measure pass does not trigger change detection.
    this.zone.runOutsideAngular(() => {
      this.pendingResize = setTimeout(() => {
        this.pendingResize = null;
        this.fit();
      }, 0);
    });
  }

  private clearPendingResize(): void {
    if (this.pendingResize !== null) {
      clearTimeout(this.pendingResize);
      this.pendingResize = null;
    }
  }

  /**
   * Renders the value imperatively: full text at the largest font that fits,
   * then a middle-ellipsized version if it still overflows at the floor size.
   */
  private fit(): void {
    if (!this.valueEl) return;

    const el = this.valueEl.nativeElement;
    const fullText = this.hidden ? this.mask : this.value;
    el.textContent = fullText;

    let fontSize = BASE_FONT_SIZE_BY_SIZE[this.size];
    el.style.fontSize = `${fontSize}px`;
    while (el.scrollWidth > el.clientWidth && fontSize > MIN_FONT_SIZE_PX) {
      fontSize -= SHRINK_STEP_PX;
      el.style.fontSize = `${fontSize}px`;
    }

    if (el.scrollWidth > el.clientWidth) {
      this.applyMiddleEllipsis(el, fullText);
    }
  }

  private applyMiddleEllipsis(el: HTMLElement, text: string): void {
    let left = Math.ceil(text.length / 2);
    let right = text.length - left;
    while (left + right > 1) {
      if (left > right) left--;
      else right--;
      el.textContent = text.slice(0, left) + ELLIPSIS + text.slice(text.length - right);
      if (el.scrollWidth <= el.clientWidth) return;
    }
  }
}
