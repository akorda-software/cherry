import * as React from "react";

interface DateTimePickerProps {
  value: Date;
  onChange?(event: { type: string; nativeEvent?: { timestamp?: number } }, date?: Date): void;
  mode?: "date" | "time" | "datetime";
  display?: "spinner" | "default" | "calendar" | "compact" | "clock" | "input";
  maximumDate?: Date;
  minimumDate?: Date;
  testID?: string;
}

export const DateTimePicker = React.forwardRef<unknown, DateTimePickerProps>(
  ({ testID }, _ref) => {
    return React.createElement("View", { testID });
  }
);

DateTimePicker.displayName = "DateTimePicker";

export type { DateTimePickerProps };
export type DateTimePickerEvent = {
  type: string;
  nativeEvent?: { timestamp?: number };
};
