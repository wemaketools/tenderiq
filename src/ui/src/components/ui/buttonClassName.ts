/** Class names of the `.tiq-btn` variants, shared by Button, ButtonLink and other button-styled elements. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'ghost' | 'link';

export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: 'md' | 'sm' = 'md',
  block = false,
  extra?: string,
): string {
  const classes = ['tiq-btn'];
  if (variant !== 'secondary') {
    classes.push(`tiq-btn--${variant}`);
  }
  if (size === 'sm') {
    classes.push('tiq-btn--sm');
  }
  if (block) {
    classes.push('tiq-btn--block');
  }
  if (extra !== undefined) {
    classes.push(extra);
  }
  return classes.join(' ');
}
