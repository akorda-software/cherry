defmodule Snack.RepoConfigurationTest do
  use ExUnit.Case, async: true

  test "every environment configures PostGIS decoding, including production" do
    for environment <- [:dev, :test, :prod] do
      config = Config.Reader.read!("config/config.exs", env: environment, target: :host)
      assert config[:snack][Snack.Repo][:types] == Snack.PostgresTypes
    end
  end
end
