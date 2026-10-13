defmodule Cherry.Dating.ProfileAgeTest do
  use ExUnit.Case, async: true

  alias Cherry.Dating.Profile

  test "counts a birthday only once it has happened this year" do
    assert Profile.age_on(~D[1995-06-15], ~D[2026-06-14]) == 30
    assert Profile.age_on(~D[1995-06-15], ~D[2026-06-15]) == 31
  end

  test "someone born on 29 February turns a year older on 1 March in common years" do
    assert Profile.age_on(~D[2008-02-29], ~D[2026-02-28]) == 17
    assert Profile.age_on(~D[2008-02-29], ~D[2026-03-01]) == 18
    assert Profile.age_on(~D[2008-02-29], ~D[2028-02-29]) == 20
  end

  test "age/1 handles missing birth dates" do
    assert Profile.age(%{birth_date: nil}) == nil
  end
end
