defmodule Cherry.FeaturesTest do
  use ExUnit.Case, async: false

  alias Cherry.Features

  setup do
    original = Application.get_env(:cherry, :features)

    on_exit(fn ->
      if original do
        Application.put_env(:cherry, :features, original)
      else
        Application.delete_env(:cherry, :features)
      end
    end)

    :ok
  end

  describe "enabled?/1" do
    test "returns false when flag is not set in app env" do
      Application.delete_env(:cherry, :features)
      assert Features.enabled?(:feature_x) == false
    end

    test "returns false when features list exists but flag is false" do
      Application.put_env(:cherry, :features, feature_x: false)
      assert Features.enabled?(:feature_x) == false
    end

    test "returns true when flag is set to true" do
      Application.put_env(:cherry, :features, feature_x: true)
      assert Features.enabled?(:feature_x) == true
    end

    test "returns false for unknown flag keys" do
      Application.put_env(:cherry, :features, feature_x: true)
      assert Features.enabled?(:nonexistent) == false
    end

    test "is generic — works for any flag key" do
      Application.put_env(:cherry, :features, feature_x: true, feature_y: false)
      assert Features.enabled?(:feature_x) == true
      assert Features.enabled?(:feature_y) == false
    end
  end
end
