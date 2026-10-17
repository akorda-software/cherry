defmodule Cherry.Casework.Lifecycle do
  @moduledoc "Transaction gate: ordinary casework can run concurrently; erasure owns a stable case graph."
  alias Cherry.Repo
  @key 716_341_022

  def participate!, do: lock!("pg_advisory_xact_lock_shared")
  def erase!, do: lock!("pg_advisory_xact_lock")

  defp lock!(function) do
    unless Repo.in_transaction?(), do: raise("casework lifecycle lock requires a transaction")
    Repo.query!("SELECT #{function}($1)", [@key], log: false)
    :ok
  end
end
