defmodule Snack.Dating.InboxCursor do
  @moduledoc false

  @salt "snack-inbox-page-v1"
  @max_age 3600

  def encode(entry, profile_id, at) do
    Phoenix.Token.sign(SnackWeb.Endpoint, @salt, %{
      viewer: profile_id,
      at: DateTime.to_unix(at, :microsecond),
      activity: DateTime.to_unix(entry.activity_at, :microsecond),
      id: entry.match.id
    })
  end

  def decode(nil, _profile_id), do: {:ok, nil}
  def decode("", _profile_id), do: {:ok, nil}

  def decode(token, profile_id) when is_binary(token) and byte_size(token) <= 2048 do
    with {:ok, %{viewer: ^profile_id, at: at, activity: activity, id: id}} <-
           Phoenix.Token.verify(SnackWeb.Endpoint, @salt, token, max_age: @max_age),
         {:ok, id} <- Ecto.UUID.cast(id),
         {:ok, at} <- DateTime.from_unix(at, :microsecond),
         {:ok, activity} <- DateTime.from_unix(activity, :microsecond) do
      {:ok, %{at: at, activity: activity, id: id}}
    else
      _ -> {:error, :invalid_cursor}
    end
  end

  def decode(_, _), do: {:error, :invalid_cursor}
end
