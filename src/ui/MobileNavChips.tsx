import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { usePendingReviewCount } from '../data/queries';
import { useLastHolding } from '../layout/last-holding';
import { Sans } from './text';

/**
 * Horizontal chip row shown in place of the sidebar below 1000px. Port of
 * `MobileNavChips` in `lib/widgets/sidebar_nav.dart`.
 */
function Chip({
  label,
  href,
  bold = false,
  muted = false,
}: {
  label: string;
  href: Href;
  bold?: boolean;
  muted?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      className="mr-1.5 rounded-[5px] border border-edge-button bg-surface-card px-[11px] py-1.5 hover:bg-surface-hover active:bg-surface-hover"
    >
      <Sans
        className={`text-[12px] ${bold ? 'font-sans-med' : ''} ${
          muted ? 'text-mid' : 'text-strong'
        }`}
      >
        {label}
      </Sans>
    </Pressable>
  );
}

export function MobileNavChips() {
  const { selected } = useLastHolding();
  const pendingReview = usePendingReviewCount();

  const detailHref: Href = selected
    ? {
        pathname: '/holdings/[instrumentId]',
        params: {
          instrumentId: selected.instrumentId,
          accountId: selected.accountId,
        },
      }
    : '/holdings';

  return (
    <View
      testID="mobileNavChips"
      className="border-b border-edge-sidebar bg-surface-sidebar px-4 py-2.5"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="Holdings" href="/holdings" bold />
        <Chip label={`${selected?.symbol ?? 'VAS'} detail`} href={detailHref} />
        <Chip label="New transaction" href="/transactions/new" bold />
        <Chip label="Income" href="/income" muted />
        <Chip
          label={pendingReview ? `Review · ${pendingReview}` : 'Review'}
          href="/import-review"
          muted
        />
        <Chip label="Imports" href="/import-sources" muted />
      </ScrollView>
    </View>
  );
}
