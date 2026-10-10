defmodule Cherry.RuntimeConfigTest do
  @moduledoc "config/runtime.exs evaluated as prod: required variables and weak secrets."
  use ExUnit.Case, async: false

  @runtime Path.expand("../../config/runtime.exs", __DIR__)

  @managed ~w(DATABASE_URL SECRET_KEY_BASE AUTH_ACCESS_TOKEN_SALT AUTH_REFRESH_TOKEN_SALT
              MESSAGE_ENCRYPTION_KEY PHX_HOST STORAGE_ADAPTER UPLOADS_DIR PUBLIC_BASE_URL PORT
              PHX_SERVER CORS_ALLOWED_ORIGINS)

  @valid %{
    "DATABASE_URL" => "ecto://u:p@db/cherry",
    "SECRET_KEY_BASE" => String.duplicate("k", 64),
    "AUTH_ACCESS_TOKEN_SALT" => String.duplicate("a", 32),
    "AUTH_REFRESH_TOKEN_SALT" => String.duplicate("r", 32),
    "MESSAGE_ENCRYPTION_KEY" => String.duplicate("m", 32),
    "PHX_HOST" => "api.cherry.example",
    "STORAGE_ADAPTER" => "r2"
  }

  setup do
    saved = Map.new(@managed, &{&1, System.get_env(&1)})

    on_exit(fn ->
      Enum.each(saved, fn
        {name, nil} -> System.delete_env(name)
        {name, value} -> System.put_env(name, value)
      end)
    end)
  end

  defp read_prod(env) do
    Enum.each(@managed, &System.delete_env/1)
    Enum.each(env, fn {name, value} -> System.put_env(name, value) end)
    Config.Reader.read!(@runtime, env: :prod, target: :host)
  end

  test "a complete configuration loads" do
    config = read_prod(@valid)
    assert config[:cherry][CherryWeb.Endpoint][:url][:host] == "api.cherry.example"
    assert config[:cherry][CherryWeb.Endpoint][:http][:port] == 4000
  end

  test "lists every missing variable in one error" do
    error =
      assert_raise RuntimeError, fn ->
        read_prod(Map.drop(@valid, ["PHX_HOST", "SECRET_KEY_BASE", "MESSAGE_ENCRYPTION_KEY"]))
      end

    assert error.message =~ "PHX_HOST is missing"
    assert error.message =~ "SECRET_KEY_BASE is missing"
    assert error.message =~ "MESSAGE_ENCRYPTION_KEY is missing"
    assert error.message =~ "mix phx.gen.secret"
  end

  test "rejects weak or placeholder secrets" do
    for {name, value} <- [
          {"SECRET_KEY_BASE", String.duplicate("k", 63)},
          {"MESSAGE_ENCRYPTION_KEY", "cambiar"},
          {"AUTH_ACCESS_TOKEN_SALT", "short"},
          {"AUTH_REFRESH_TOKEN_SALT", "CAMBIAR"}
        ] do
      error = assert_raise RuntimeError, fn -> read_prod(Map.put(@valid, name, value)) end
      assert error.message =~ "#{name} is too weak"
    end
  end

  test "an invalid PORT has a clear message" do
    for port <- ["abc", "0", "70000", "80x"] do
      error = assert_raise RuntimeError, fn -> read_prod(Map.put(@valid, "PORT", port)) end
      assert error.message =~ "PORT is invalid"
    end

    assert read_prod(Map.put(@valid, "PORT", "8080"))[:cherry][CherryWeb.Endpoint][:http][:port] ==
             8080
  end

  test "local storage requires UPLOADS_DIR and PUBLIC_BASE_URL" do
    local = Map.merge(@valid, %{"STORAGE_ADAPTER" => "local", "UPLOADS_DIR" => "/var/lib/cherry"})

    error = assert_raise RuntimeError, fn -> read_prod(local) end
    assert error.message =~ "PUBLIC_BASE_URL is required"

    config = read_prod(Map.put(local, "PUBLIC_BASE_URL", "https://api.cherry.example"))
    assert config[:cherry][:public_base_url] == "https://api.cherry.example"
  end
end
