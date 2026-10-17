defmodule Cherry.Casework.Pagination do
  @moduledoc false
  def offset(params), do: normalize(params["offset"])
  def normalize(n) when is_integer(n) and n in 0..10_000, do: n

  def normalize(value) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} when n in 0..10_000 -> n
      _ -> 0
    end
  end

  def normalize(_), do: 0
end
