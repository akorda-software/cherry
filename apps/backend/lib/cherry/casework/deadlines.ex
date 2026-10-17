defmodule Cherry.Casework.Deadlines do
  @moduledoc "Conservative calendar-month reminder, not a legal extension or a delivery receipt."

  def response_date(%{kind: "privacy", inserted_at: at}), do: add_month(DateTime.to_date(at))
  def response_date(_), do: nil

  def overdue?(record, today \\ Date.utc_today()) do
    case response_date(record) do
      nil -> false
      date -> record.status == "open" and Date.compare(today, date) == :gt
    end
  end

  defp add_month(%Date{year: year, month: month, day: day}) do
    {year, month} = if month == 12, do: {year + 1, 1}, else: {year, month + 1}
    first = Date.new!(year, month, 1)
    Date.new!(year, month, min(day, Date.days_in_month(first)))
  end
end
