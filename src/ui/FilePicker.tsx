import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { View } from 'react-native';

import { ActionButton } from './ActionButton';
import { Mono, Sans } from './text';

/**
 * Native file picker. The web build resolves `FilePicker.web.tsx` instead --
 * Metro picks the platform extension, and this file is the fallback for iOS
 * and Android.
 *
 * Both implementations hand back a `Blob`, so nothing above them knows which
 * platform produced it.
 */

export interface PickedFile {
  file: Blob;
  filename: string;
  size: number;
}

export interface FilePickerProps {
  onPick: (file: PickedFile) => void;
  picked: PickedFile | null;
  disabled?: boolean;
  /** Rejected before upload, so an oversized file costs nothing. */
  maxBytes: number;
}

export function FilePicker({
  onPick,
  picked,
  disabled,
  maxBytes,
}: FilePickerProps) {
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    if (asset.size !== undefined && asset.size !== null && asset.size > maxBytes) {
      setError(tooLarge(asset.size, maxBytes));
      return;
    }

    // The picker hands back a URI, not bytes. fetch() reads it into a Blob,
    // which is the same shape the web input produces.
    const response = await fetch(asset.uri);
    const file = await response.blob();
    if (file.size > maxBytes) {
      setError(tooLarge(file.size, maxBytes));
      return;
    }

    onPick({ file, filename: asset.name, size: file.size });
  };

  return (
    <View>
      <ActionButton
        testID="pickFile"
        label={picked ? 'Choose a different file' : 'Choose a CSV file'}
        onPress={disabled ? undefined : () => void choose()}
      />
      {picked ? (
        <Mono testID="pickedFile" className="mt-2 text-[11.5px] text-mid">
          {`${picked.filename} · ${formatBytes(picked.size)}`}
        </Mono>
      ) : null}
      {error ? (
        <Sans testID="filePickerError" className="mt-2 text-[12px] text-negative">
          {error}
        </Sans>
      ) : null}
    </View>
  );
}

export function tooLarge(size: number, maxBytes: number): string {
  return `That file is ${formatBytes(size)}. The limit is ${formatBytes(
    maxBytes,
  )} — split it and import the parts.`;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
