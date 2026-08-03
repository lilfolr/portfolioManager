import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { Mono, Sans } from './text';
import {
  formatBytes,
  tooLarge,
  type FilePickerProps,
  type PickedFile,
} from './FilePicker';

export type { FilePickerProps, PickedFile };

/**
 * Web file picker: a hidden `<input type="file">` plus a drop target.
 *
 * Web is the primary surface for the ledger, and dragging a broker export onto
 * the page is how people actually do this, so the drop zone is not decoration.
 * React Native has no file input, hence the raw DOM element -- this file only
 * ever runs under react-native-web, where `document` exists.
 */
export function FilePicker({
  onPick,
  picked,
  disabled,
  maxBytes,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > maxBytes) {
      setError(tooLarge(file.size, maxBytes));
      return;
    }
    onPick({ file, filename: file.name, size: file.size });
  };

  const open = () => inputRef.current?.click();

  return (
    <View>
      {/* Not a React Native node: rendered straight into the DOM by
          react-native-web. Kept out of the layout entirely rather than hidden
          with opacity, so it can never intercept a press. */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        style={{ display: 'none' }}
        data-testid="fileInput"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Reset so choosing the same file twice still fires a change.
          event.target.value = '';
        }}
      />

      <Pressable
        testID="fileDropZone"
        accessibilityRole="button"
        disabled={disabled}
        onPress={disabled ? undefined : open}
        // @ts-expect-error react-native-web forwards DOM drag handlers on a
        // Pressable, but the React Native types have no equivalent props.
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          accept(event.dataTransfer?.files?.[0]);
        }}
        className={`items-center justify-center rounded-md border border-dashed px-4 py-7 ${
          dragging
            ? 'border-link bg-surface-info-box'
            : 'border-edge-control bg-surface-card hover:bg-surface-hover'
        }`}
      >
        <Sans className="text-[13px] text-strong">
          {picked ? picked.filename : 'Drop a CSV here, or click to choose one'}
        </Sans>
        <Mono className="mt-1.5 text-[11px] text-faint">
          {picked
            ? `${formatBytes(picked.size)} · click to choose a different file`
            : `up to ${formatBytes(maxBytes)}`}
        </Mono>
      </Pressable>

      {picked ? (
        <View className="mt-2 flex-row">
          <ActionButton
            testID="pickFile"
            label="Choose a different file"
            onPress={disabled ? undefined : open}
          />
        </View>
      ) : null}

      {error ? (
        <Sans testID="filePickerError" className="mt-2 text-[12px] text-negative">
          {error}
        </Sans>
      ) : null}
    </View>
  );
}
