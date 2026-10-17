defmodule Cherry.CaseworkDeadlinesTest do
  use ExUnit.Case, async: true
  alias Cherry.Casework.Deadlines

  test "calendar month, including leap February and year boundary, not 30 days" do
    for {at, expected} <- [
          {~U[2026-01-31 10:00:00Z], ~D[2026-02-28]},
          {~U[2028-01-31 10:00:00Z], ~D[2028-02-29]},
          {~U[2026-12-17 10:00:00Z], ~D[2027-01-17]}
        ] do
      record = %{kind: "privacy", status: "open", inserted_at: at}
      assert Deadlines.response_date(record) == expected
      refute Deadlines.overdue?(record, expected)
      assert Deadlines.overdue?(record, Date.add(expected, 1))
      refute Deadlines.overdue?(%{record | status: "resolved"}, Date.add(expected, 1))
    end
  end

  test "no invented universal deadline for moderation" do
    assert Deadlines.response_date(%{kind: "report"}) == nil
    refute Deadlines.overdue?(%{kind: "report"})
  end
end
