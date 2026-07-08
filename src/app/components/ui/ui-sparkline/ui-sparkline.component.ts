import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

export type SparklineTone = 'up' | 'down' | 'auto' | 'accent';

/**
 * A dependency-free SVG price sparkline. Presentational and @Input-driven; the consumer slices the
 * series for the desired range and passes the raw points (oldest -> newest). Renders nothing when
 * there are fewer than two points, so a fresh install with no history shows no fake flat line.
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

  // Precomputed on input change so the template never recomputes paths per change-detection tick.
  public visible = false;
  public linePath = '';
  public areaPath = '';
  // SCR-101: 'accent' renders the burnt-orange line + gradient area + last-point dot.
  public toneClass: 'up' | 'down' | 'accent' = 'up';
  // Last data point, exposed so the template can draw the accent end dot.
  public lastX = 0;
  public lastY = 0;

  ngOnChanges(): void {
    this.rebuild();
  }

  private rebuild(): void {
    let points = this.points;
    if (!points || points.length < 2) {
      this.visible = false;
      this.linePath = '';
      this.areaPath = '';
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
}
