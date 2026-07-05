import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

export type SparklineTone = 'up' | 'down' | 'auto';

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
  public toneClass: 'up' | 'down' = 'up';

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
    let range = max - min || 1; // guard a flat series (draws a horizontal mid-line)
    let innerWidth = this.width - 2 * this.padding;
    let innerHeight = this.height - 2 * this.padding;

    let coords = points.map((value, index) => {
      let x = this.padding + (index / (count - 1)) * innerWidth;
      // SVG y grows downward, so invert.
      let y = this.height - this.padding - ((value - min) / range) * innerHeight;
      return { x, y };
    });

    this.linePath = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
      .join(' ');

    let baseline = (this.height - this.padding).toFixed(2);
    let first = coords[0];
    let last = coords[coords.length - 1];
    this.areaPath = `${this.linePath} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`;

    this.toneClass = this.resolveTone(points);
  }

  private resolveTone(points: number[]): 'up' | 'down' {
    if (this.tone === 'up' || this.tone === 'down') return this.tone;
    return points[points.length - 1] >= points[0] ? 'up' : 'down';
  }
}
