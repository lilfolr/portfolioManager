import { View } from 'react-native';

import { FY_OPTIONS, useFinancialYear } from '../layout/financial-year';
import { Select } from './Select';
import { Mono, Sans } from './text';

/** Breadcrumb + search box + FY selector strip. Port of `lib/widgets/top_bar.dart`. */
export function TopBar({
  crumb,
  showSearch,
  horizontalPadding,
}: {
  crumb: string;
  showSearch: boolean;
  horizontalPadding: number;
}) {
  const { fy, setFy } = useFinancialYear();

  return (
    <View
      className="flex-row items-center border-b border-edge-subtle bg-surface-top-bar py-2.5"
      style={{ paddingHorizontal: horizontalPadding }}
    >
      <Mono
        numberOfLines={1}
        testID="breadcrumb"
        className="flex-1 text-[11.5px] leading-[1.3] text-muted"
      >
        {crumb}
      </Mono>

      {showSearch ? (
        <View className="mr-2 h-7 w-[230px] flex-row items-center rounded-[5px] border border-edge-control px-[9px]">
          <View className="h-[9px] w-[9px] rounded-full border-[1.5px] border-faint" />
          <Sans
            numberOfLines={1}
            className="ml-[7px] flex-1 text-[12px] text-faint"
          >
            Search symbol, parcel, txn id
          </Sans>
          <Mono className="text-[10px] text-icon-muted">/</Mono>
        </View>
      ) : null}

      <Select
        testID="fySelect"
        value={fy}
        options={FY_OPTIONS}
        onChange={setFy}
      />
    </View>
  );
}
