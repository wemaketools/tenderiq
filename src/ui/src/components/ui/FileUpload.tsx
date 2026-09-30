/**
 * FileUpload: drag and drop or browse, type and size checks, SHA-256 with WebCrypto, then the SUPPLIED upload
 * function (for example the two-step document envelope of `DocumentUploader`). Progress and results are announced
 * in a polite live region (PRD §19).
 */
import { useId, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';

import { formatBytes } from '../../lib/format';
import { sha256Hex } from '../../lib/hash';
import { t } from '../../lib/i18n';
import { isApiError } from '../../api/client';
import { Icon } from './Icon';
import { IconButton } from './Button';
import { describeError } from './errors';

export interface UploadContext {
  /** Lowercase hex SHA-256 of the file. */
  readonly sha256: string;
  /** Reports transfer progress (0..1). */
  readonly onProgress: (fraction: number) => void;
}

export interface FileUploadProps {
  readonly label: string;
  readonly hint?: ReactNode;
  /** Accepted MIME types (the contract's allowed content types). */
  readonly accept?: readonly string[];
  readonly maxBytes?: number;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  /** Uploads one file. Reject with an ApiError to show its message. */
  readonly onUpload: (file: File, context: UploadContext) => Promise<void>;
}

type ItemState = 'hashing' | 'uploading' | 'done' | 'error';

interface UploadItem {
  readonly key: string;
  readonly name: string;
  readonly size: number;
  readonly state: ItemState;
  readonly progress: number;
  readonly message: string | null;
}

export function FileUpload({
  label,
  hint,
  accept,
  maxBytes,
  multiple = false,
  disabled = false,
  onUpload,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<readonly UploadItem[]>([]);

  const patch = (key: string, change: Partial<UploadItem>): void => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  };

  const process = async (file: File, key: string): Promise<void> => {
    if (accept !== undefined && accept.length > 0 && !accept.includes(file.type)) {
      patch(key, { state: 'error', message: t('ui.upload.typeNotAllowed') });
      return;
    }
    if (file.size === 0) {
      patch(key, { state: 'error', message: t('ui.upload.empty') });
      return;
    }
    if (maxBytes !== undefined && file.size > maxBytes) {
      patch(key, {
        state: 'error',
        message: t('ui.upload.tooLarge', { max: formatBytes(maxBytes) }),
      });
      return;
    }
    try {
      const sha256 = await sha256Hex(file);
      patch(key, { state: 'uploading', progress: 0 });
      await onUpload(file, {
        sha256,
        onProgress: (fraction) => patch(key, { progress: fraction }),
      });
      patch(key, { state: 'done', progress: 1, message: null });
    } catch (error) {
      patch(key, {
        state: 'error',
        message: isApiError(error) ? describeError(error) : t('ui.upload.failed'),
      });
    }
  };

  const addFiles = (files: FileList | null): void => {
    if (files === null || disabled) return;
    const selected = multiple ? Array.from(files) : Array.from(files).slice(0, 1);
    const stamp = Date.now();
    const added = selected.map((file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      state: 'hashing' as ItemState,
      progress: 0,
      message: null,
    }));
    setItems((list) => [...list, ...added]);
    selected.forEach((file, index) => {
      const item = added[index];
      if (item !== undefined) {
        void process(file, item.key);
      }
    });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const classes = ['tiq-dropzone'];
  if (dragging) classes.push('tiq-dropzone--active');
  if (disabled) classes.push('tiq-dropzone--disabled');

  return (
    <div className="tiq-field">
      <label htmlFor={inputId} className="tiq-field-label">
        {label}
      </label>
      <div
        className={classes.join(' ')}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={hint === undefined ? undefined : `${inputId}-hint`}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="uploadCloud" />
        <span>{t('ui.upload.drop')}</span>
        {maxBytes !== undefined && (
          <span>{t('ui.upload.limit', { max: formatBytes(maxBytes) })}</span>
        )}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="tiq-visually-hidden"
        accept={accept?.join(',')}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${inputId}-hint`}>
          {hint}
        </p>
      )}
      {items.length > 0 && (
        <ul className="tiq-upload-list" aria-live="polite" aria-label={t('ui.upload.listLabel')}>
          {items.map((item) => (
            <li key={item.key} className="tiq-upload-item" data-state={item.state}>
              <Icon
                name={
                  item.state === 'done'
                    ? 'checkCircle'
                    : item.state === 'error'
                      ? 'alertOctagon'
                      : 'file'
                }
              />
              <span>
                {item.name} <span className="tiq-text-muted">({formatBytes(item.size)})</span>
                <span
                  className={
                    item.state === 'error' ? 'tiq-cell-sub tiq-text-danger' : 'tiq-cell-sub'
                  }
                >
                  {item.message ?? t(`ui.upload.state.${item.state}`)}
                </span>
              </span>
              {(item.state === 'done' || item.state === 'error') && (
                <IconButton
                  icon="x"
                  size="sm"
                  variant="ghost"
                  label={t('ui.upload.remove', { name: item.name })}
                  onClick={() => setItems((list) => list.filter((entry) => entry.key !== item.key))}
                />
              )}
              {(item.state === 'hashing' || item.state === 'uploading') && (
                <progress
                  max={1}
                  value={item.state === 'hashing' ? undefined : item.progress}
                  aria-label={t('ui.upload.progress', { name: item.name })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
