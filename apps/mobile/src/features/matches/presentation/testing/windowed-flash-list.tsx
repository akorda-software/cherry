import { type ComponentType, type ReactElement, type ReactNode, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/** Mock focal: prueba el contrato y el cambio de ventana, NO el layout/rendimiento nativo de FlashList. */
interface WindowedListProps<T> {
  data: T[];
  testID: string;
  horizontal?: boolean;
  extraData?: unknown;
  renderItem(info: { item: T; index: number; target: "Cell" }): ReactNode;
  keyExtractor(item: T, index: number): string;
  getItemType?(item: T): string;
  ListFooterComponent?: ReactNode;
  ItemSeparatorComponent?: ComponentType;
  refreshControl?: ReactElement<{ onRefresh(): void; refreshing: boolean }>;
  onScroll?(event: NativeSyntheticEvent<NativeScrollEvent>): void;
}

// Ocho celdas por eje: nunca convierte las 1000+ entradas en elementos React.
export const TEST_WINDOW_SIZE = 8;
export const windowedLists = new Map<string, WindowedListProps<unknown>>();

export function FlashList<T>(props: WindowedListProps<T>) {
  const [start, setStart] = useState(0);
  const { data, testID, keyExtractor, renderItem, ItemSeparatorComponent: Separator } = props;
  windowedLists.set(testID, props as WindowedListProps<unknown>);
  const scroll = (offset: number) => props.onScroll?.({
    nativeEvent: {
      layoutMeasurement: { height: 600 },
      contentOffset: { y: offset },
      contentSize: { height: 1_200 }
    }
  } as NativeSyntheticEvent<NativeScrollEvent>);
  return (
    <div data-testid={testID} data-total-count={data.length}>
      {data.slice(start, start + TEST_WINDOW_SIZE).map((item, offset) => (
        <div key={keyExtractor(item, start + offset)}>
          {offset > 0 && Separator ? <Separator /> : null}
          {renderItem({ item, index: start + offset, target: "Cell" })}
        </div>
      ))}
      {props.ListFooterComponent}
      <button data-testid={`${testID}-next-window`} onClick={() => setStart((n) => n + TEST_WINDOW_SIZE)}>Next window</button>
      <button data-testid={`${testID}-end`} onClick={() => scroll(400)}>Near end</button>
      <button data-testid={`${testID}-start`} onClick={() => scroll(0)}>Far from end</button>
      {props.refreshControl ? (
        <button data-testid={`${testID}-refresh`} onClick={props.refreshControl.props.onRefresh}>Refresh</button>
      ) : null}
    </div>
  );
}
