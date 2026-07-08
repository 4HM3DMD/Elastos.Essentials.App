import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';

export type SparklineTone = 'up' | 'down' | 'auto' | 'accent';

/**
 * A dependency-free SVG price sparkline. Presentational and @Input-driven; the consumer slices the
 * series for the desired range and passes the raw points (oldest -> newest). Renders nothing when
 * there are fewer than two points, so a fresh install with no history shows no fake flat line.
 *
 * SCR-097: supports press-and-hold scrubbing. On touch/drag it snaps to the nearest data point,
 * draws a dashed vertical cursor + an orange dot on the curve, and emits the scrubbed index via
 * (scrub) so the consumer (coin-home) can update its price/date readout. Emits null on release.
 */
@Component({
  selector: 'ui-sparkline',
  templateUrl: './ui-sparkline.component.html',
  styleUrls: ['./ui-sparkline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSparklineComponent implements OnChanges {
  @Input() public points: number[] = [];
  @Input() public width = 320;
  @Input() public height = 96;
  @Input() public strokeWidth = 2;
  @Input() public padding = 4;
  @Input() public area = true;
  @Input() public tone: SparklineTone = 'auto';

  /** Index (into points) currently being scrubbed, or null when the finger is lifted. */
  @Output() public scrub = new EventEmitter<number | null>();

  @ViewChild('svg', { static: false }) private svgRef: ElementRef<SVGElement>;

  // Precomputed on input change so the template never recomputes paths per change-detection tick.
  public visible = false;
  public linePath = '';
  public areaPath = '';
  // SCR-101: 'accent' renders the burnt-orange line + gradient area + last-point dot.
  public toneClass: 'up' | 'down' | 'accent' = 'up';
  // Last data point, exposed so the template can draw the accent end dot.
  public lastX = 0;
  public lastY = 0;

  // SCR-097 scrub state (all in viewBox units).
  public scrubbing = false;
  public scrubX = 0;
  public scrubY = 0;

  private coords: { x: number; y: number }[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this.rebuild();
  }

  private rebuild(): void {
    let points = this.points;
    if (!points || points.length < 2) {
      this.visible = false;
      this.linePath = '';
      this.areaPath = '';
      this.coords = [];
      return;
    }
    this.visible = true;

    let count = points.length;
    let min = Math.min(...points);
    let max = Math.max(...points);
    let span = max - min;
    let innerWidth = this.width - 2 * this.padding;
    let innerHeight = this.height - 2 * this.padding;

    let coords = points.map((value, index) => {
      let x = this.padding + (index / (count - 1)) * innerWidth;
      // A flat series (span 0) draws a horizontal mid-line. SVG y grows downward, so invert.
      let norm = span === 0 ? 0.5 : (value - min) / span;
      let y = this.height - this.padding - norm * innerHeight;
      return { x, y };
    });
    this.coords = coords;

    this.linePath = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
      .join(' ');

    let baseline = (this.height - this.padding).toFixed(2);
    let first = coords[0];
    let last = coords[coords.length - 1];
    this.lastX = last.x;
    this.lastY = last.y;
    this.areaPath = `${this.linePath} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`;

    this.toneClass = this.resolveTone(points);
  }

  private resolveTone(points: number[]): 'up' | 'down' | 'accent' {
    if (this.tone === 'up' || this.tone === 'down' || this.tone === 'accent') return this.tone;
    return points[points.length - 1] >= points[0] ? 'up' : 'down';
  }

  // --- SCR-097 scrubbing ---
  public onScrubStart(event: TouchEvent | MouseEvent): void {
    if (!this.visible) return;
    this.scrubbing = true;
    this.updateScrub(event);
  }

  public onScrubMove(event: TouchEvent | MouseEvent): void {
    if (!this.scrubbing) return;
    // Prevent the page from scrolling while scrubbing the chart.
    if ((event as TouchEvent).touches) event.preventDefault();
    this.updateScrub(event);
  }

  public onScrubEnd(): void {
    if (!this.scrubbing) return;
    this.scrubbing = false;
    this.scrub.emit(null);
    this.cdr.markForCheck();
  }

  private updateScrub(event: TouchEvent | MouseEvent): void {
    if (!this.coords.length || !this.svgRef) return;
    let rect = this.svgRef.nativeElement.getBoundingClientRect();
    let touch = (event as TouchEvent).touches;
    let clientX = touch && touch.length ? touch[0].clientX : (event as MouseEvent).clientX;
    if (clientX == null || rect.width === 0) return;
    // Map the screen x into viewBox units (preserveAspectRatio=none scales x by width).
    let vbX = ((clientX - rect.left) / rect.width) * this.width;
    // Snap to the nearest data point.
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < this.coords.length; i++) {
      let d = Math.abs(this.coords[i].x - vbX);
      if (d < best) { best = d; index = i; }
    }
    this.scrubX = this.coords[index].x;
    this.scrubY = this.coords[index].y;
    this.scrub.emit(index);
    this.cdr.markForCheck();
  }
}
