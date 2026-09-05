defmodule SnackWeb.Pagination do
  @moduledoc false

  def limit(params, default) do
    case Map.get(params, "limit", default) do
      value when is_integer(value) and value in 1..100 ->
        {:ok, value}

      value when is_binary(value) ->
        case Integer.parse(value) do
          {limit, ""} when limit in 1..100 -> {:ok, limit}
          _ -> {:error, :invalid_limit}
        end

      _ ->
        {:error, :invalid_limit}
    end
  end
end
