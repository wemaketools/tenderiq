/**
 * `Icon`: one line icon of the hand-rolled set (`icons.ts`). Decorative by default (`aria-hidden`); pass `label`
 * when the icon alone carries meaning.
 */
import { ICONS } from './icons';
import type { IconElement, IconName } from './icons';

export type { IconName } from './icons';

export interface IconProps {
  readonly name: IconName;
  /** Accessible name; omit for decorative icons next to visible text. */
  readonly label?: string;
  readonly className?: string;
  /** Pixel size of the square icon (CSS classes usually size it). */
  readonly size?: number;
}

function renderElement(element: IconElement, key: number) {
  switch (element.tag) {
    case 'path':
      return <path key={key} d={element.d} />;
    case 'circle':
      return <circle key={key} cx={element.cx} cy={element.cy} r={element.r} />;
    case 'rect':
      return (
        <rect
          key={key}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={element.rx}
        />
      );
    case 'line':
      return <line key={key} x1={element.x1} y1={element.y1} x2={element.x2} y2={element.y2} />;
    case 'polyline':
      return <polyline key={key} points={element.points} />;
  }
}

export function Icon({ name, label, className, size }: IconProps) {
  const elements: readonly IconElement[] = ICONS[name];
  return (
    <svg
      className={className === undefined ? 'tiq-icon' : `tiq-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      focusable="false"
      data-icon={name}
    >
      {label !== undefined && <title>{label}</title>}
      {elements.map(renderElement)}
    </svg>
  );
}
