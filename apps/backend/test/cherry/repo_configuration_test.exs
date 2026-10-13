defmodule Cherry.RepoConfigurationTest do
  use ExUnit.Case, async: true

  test "every environment configures PostGIS decoding, including production" do
    for environment <- [:dev, :test, :prod] do
      config = Config.Reader.read!("config/config.exs", env: environment, target: :host)
      assert config[:cherry][Cherry.Repo][:types] == Cherry.PostgresTypes
    end
  end
end
