defmodule Snack.Notifications.ExpoClient do
  @moduledoc """
  Behaviour for Expo Push API clients.
  """

  @callback send_messages(messages :: [map()], opts :: Keyword.t()) ::
              {:ok, [map()]} | {:error, term()}
end
