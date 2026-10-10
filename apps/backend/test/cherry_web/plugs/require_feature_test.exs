defmodule CherryWeb.Plugs.RequireFeatureTest do
  use CherryWeb.ConnCase, async: false

  alias CherryWeb.Plugs.RequireFeature

  describe "call/2" do
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

    test "halts with 404 when flag is disabled" do
      Application.put_env(:cherry, :features, feature_x: false)

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.fetch_query_params()
        |> RequireFeature.call(:feature_x)

      assert conn.halted == true
      assert conn.status == 404
    end

    test "passes through when flag is enabled" do
      Application.put_env(:cherry, :features, feature_x: true)

      conn =
        Phoenix.ConnTest.build_conn()
        |> RequireFeature.call(:feature_x)

      assert conn.halted == false
      assert conn.status == nil
    end

    test "halts when feature config is absent" do
      Application.delete_env(:cherry, :features)

      conn =
        Phoenix.ConnTest.build_conn()
        |> RequireFeature.call(:feature_x)

      assert conn.halted == true
      assert conn.status == 404
    end

    test "works generically for any feature flag" do
      Application.put_env(:cherry, :features, feature_x: true)

      conn =
        Phoenix.ConnTest.build_conn()
        |> RequireFeature.call(:feature_x)

      assert conn.halted == false

      conn =
        Phoenix.ConnTest.build_conn()
        |> RequireFeature.call(:feature_y)

      assert conn.halted == true
    end
  end
end
