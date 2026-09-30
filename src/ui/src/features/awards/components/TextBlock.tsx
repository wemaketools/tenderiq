/** Multi-line business text (rationale, notice body, response) rendered as paragraphs; empty text shows a note. */
import { t } from '../../../lib/i18n';

export interface TextBlockProps {
  readonly text: string | null | undefined;
  /** Shown when the text is empty (defaults to "Not recorded"). */
  readonly empty?: string;
}

export function TextBlock({ text, empty }: TextBlockProps) {
  const paragraphs = (text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (paragraphs.length === 0) {
    return <p className="tiq-text-muted">{empty ?? t('awards.common.notRecorded')}</p>;
  }
  return (
    <div className="tiq-stack">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
