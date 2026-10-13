defmodule Cherry.InstanceTest do
  use ExUnit.Case, async: false

  setup do
    previous = Application.get_env(:cherry, :instance)
    on_exit(fn -> Application.put_env(:cherry, :instance, previous) end)
  end

  test "defaults keep the Spanish instance" do
    Application.delete_env(:cherry, :instance)

    assert %{name: "Cherry", country: "ES", locale: "es-ES", operator: nil} =
             Cherry.Instance.info()

    assert Cherry.Instance.language() == "es"
  end

  test "the language is the primary subtag of the locale" do
    Application.put_env(:cherry, :instance, locale: "fr-FR")
    assert Cherry.Instance.language() == "fr"

    Application.put_env(:cherry, :instance, locale: "eu")
    assert Cherry.Instance.language() == "eu"
  end
end
