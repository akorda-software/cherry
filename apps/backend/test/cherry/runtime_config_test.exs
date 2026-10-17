defmodule Cherry.RuntimeConfigTest do
  @moduledoc "config/runtime.exs evaluated as prod: required variables and weak secrets."
  use ExUnit.Case, async: false

  @runtime Path.expand("../../config/runtime.exs", __DIR__)

  @managed ~w(DATABASE_URL SECRET_KEY_BASE AUTH_ACCESS_TOKEN_SALT AUTH_REFRESH_TOKEN_SALT
              MESSAGE_ENCRYPTION_KEY PHX_HOST STORAGE_ADAPTER UPLOADS_DIR PUBLIC_BASE_URL PORT
              PHX_SERVER CORS_ALLOWED_ORIGINS INSTANCE_NAME INSTANCE_COUNTRY INSTANCE_LOCALE
              INSTANCE_OPERATOR INSTANCE_CONTACT_EMAIL INSTANCE_PRIVACY_URL INSTANCE_TERMS_URL
              INSTANCE_SOURCE_URL AGE_VERIFICATION_MINIMUM_AGE AGE_VERIFICATION_DOCUMENTS
              CSCA_PATHS CSCA_COUNTRIES BACKOFFICE_HOST)

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

  test "the optional staff host is exact, normalized and separate from the public host" do
    assert read_prod(@valid)[:cherry][:backoffice_host] == nil

    assert read_prod(Map.put(@valid, "BACKOFFICE_HOST", " Admin.Cherry.Example "))[:cherry][
             :backoffice_host
           ] == "admin.cherry.example"

    for host <- [
          "https://admin.cherry.example",
          "admin.cherry.example:443",
          "admin.cherry.example/backoffice",
          "*.cherry.example",
          ".cherry.example",
          "admin..cherry.example",
          "admin.cherry.example.",
          "-admin.cherry.example",
          "admin_.cherry.example",
          String.duplicate("a", 64) <> ".example"
        ] do
      assert_raise RuntimeError, ~r/BACKOFFICE_HOST must be an exact hostname/, fn ->
        read_prod(Map.put(@valid, "BACKOFFICE_HOST", host))
      end
    end

    assert_raise RuntimeError, ~r/BACKOFFICE_HOST must differ/, fn ->
      read_prod(Map.put(@valid, "BACKOFFICE_HOST", "API.CHERRY.EXAMPLE"))
    end
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

  test "instance identity defaults to the Spanish instance, without operator data" do
    instance = read_prod(@valid)[:cherry][:instance]

    assert instance[:name] == "Cherry"
    assert instance[:country] == "ES"
    assert instance[:locale] == "es-ES"
    assert instance[:operator] == nil
    assert instance[:contact_email] == nil
    assert instance[:privacy_url] == nil
  end

  test "instance identity from the environment, validated" do
    instance =
      read_prod(
        Map.merge(@valid, %{
          "INSTANCE_NAME" => "Cherry France",
          "INSTANCE_COUNTRY" => "fr",
          "INSTANCE_LOCALE" => "fr-FR",
          "INSTANCE_OPERATOR" => "Association Cherry FR",
          "INSTANCE_CONTACT_EMAIL" => "contact@cherry.example",
          "INSTANCE_PRIVACY_URL" => "https://cherry.example/confidentialite",
          "INSTANCE_TERMS_URL" => "https://cherry.example/conditions",
          "INSTANCE_SOURCE_URL" => "https://git.example.org/cherry-fr"
        })
      )[:cherry][:instance]

    assert instance[:name] == "Cherry France"
    assert instance[:country] == "FR"
    assert instance[:locale] == "fr-FR"
    assert instance[:contact_email] == "contact@cherry.example"
    assert instance[:terms_url] == "https://cherry.example/conditions"

    for {name, value, message} <- [
          {"INSTANCE_COUNTRY", "FRA", "INSTANCE_COUNTRY must be"},
          {"INSTANCE_LOCALE", "french", "INSTANCE_LOCALE must be"},
          {"INSTANCE_CONTACT_EMAIL", "nobody", "INSTANCE_CONTACT_EMAIL must be"},
          {"INSTANCE_PRIVACY_URL", "javascript:alert(1)", "INSTANCE_PRIVACY_URL must be"}
        ] do
      error = assert_raise RuntimeError, fn -> read_prod(Map.put(@valid, name, value)) end
      assert error.message =~ message
    end
  end

  test "age verification: minimum age, documents and trusted CSCA countries" do
    defaults = read_prod(@valid)[:cherry]
    assert defaults[:age_verification][:minimum_age] == 18
    assert defaults[:age_verification][:accepted_documents] == [:id_card, :passport]
    refute Keyword.has_key?(defaults, Cherry.Identity.Document.TrustStore)

    config =
      read_prod(
        Map.merge(@valid, %{
          "AGE_VERIFICATION_MINIMUM_AGE" => "21",
          "AGE_VERIFICATION_DOCUMENTS" => "passport",
          "CSCA_COUNTRIES" => "ES, fr"
        })
      )[:cherry]

    assert config[:age_verification][:minimum_age] == 21
    assert config[:age_verification][:accepted_documents] == [:passport]
    assert config[Cherry.Identity.Document.TrustStore][:countries] == ["es", "fr"]

    for {name, value} <- [
          {"AGE_VERIFICATION_MINIMUM_AGE", "16"},
          {"AGE_VERIFICATION_MINIMUM_AGE", "x"},
          {"AGE_VERIFICATION_DOCUMENTS", "driving_licence"},
          {"AGE_VERIFICATION_DOCUMENTS", ","},
          {"CSCA_COUNTRIES", "spain"}
        ] do
      error = assert_raise RuntimeError, fn -> read_prod(Map.put(@valid, name, value)) end
      assert error.message =~ name
    end
  end
end
