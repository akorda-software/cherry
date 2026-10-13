defmodule Cherry.Instance do
  @moduledoc """
  Identity of this Cherry instance: one instance per country, each run by its
  own operator (see `TRADEMARKS.md` and `docs/12-self-hosting.md`).

  Config `:cherry, :instance` (runtime env `INSTANCE_*`):

    * `name`: shown in the app (`INSTANCE_NAME`, "Cherry").
    * `country`: ISO 3166-1 alpha-2 code of the country it serves
      (`INSTANCE_COUNTRY`, "ES").
    * `locale`: default language tag (`INSTANCE_LOCALE`, "es-ES"); used for
      the language of external flows such as Didit's.
    * `operator`, `contact_email`: who runs the instance and how to reach them.
    * `privacy_url`, `terms_url`: legal texts of the instance.
    * `source_url`: source code of the version it runs (AGPL-3.0).

  Everything here is public: `GET /api/config` returns it.
  """

  @type t :: %{
          name: String.t(),
          country: String.t(),
          locale: String.t(),
          operator: String.t() | nil,
          contact_email: String.t() | nil,
          privacy_url: String.t() | nil,
          terms_url: String.t() | nil,
          source_url: String.t() | nil
        }

  @defaults [
    name: "Cherry",
    country: "ES",
    locale: "es-ES",
    operator: nil,
    contact_email: nil,
    privacy_url: nil,
    terms_url: nil,
    source_url: nil
  ]

  @doc "The instance identity, with defaults for missing keys."
  @spec info() :: t()
  def info do
    config = Application.get_env(:cherry, :instance, [])
    Map.new(@defaults, fn {key, default} -> {key, Keyword.get(config, key, default)} end)
  end

  @doc "Default language tag of the instance (`\"es-ES\"`)."
  @spec locale() :: String.t()
  def locale, do: info().locale

  @doc "Primary language of the instance locale (`\"es\"` for `\"es-ES\"`)."
  @spec language() :: String.t()
  def language, do: locale() |> String.split("-") |> hd() |> String.downcase()
end
