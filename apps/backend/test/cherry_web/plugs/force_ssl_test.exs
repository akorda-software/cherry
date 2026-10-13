defmodule CherryWeb.Plugs.ForceSSLTest do
  use CherryWeb.ConnCase, async: false

  alias CherryWeb.Plugs.ForceSSL

  @ssl_opts [rewrite_on: [:x_forwarded_proto], hsts: true, exclude: ["localhost", "127.0.0.1"]]

  setup do
    original = Application.get_env(:cherry, :force_ssl)

    on_exit(fn ->
      if original == nil,
        do: Application.delete_env(:cherry, :force_ssl),
        else: Application.put_env(:cherry, :force_ssl, original)
    end)

    :ok
  end

  defp request(host, headers \\ []) do
    conn = Plug.Test.conn(:get, "http://#{host}/healthz")
    conn = Enum.reduce(headers, conn, fn {k, v}, c -> Plug.Conn.put_req_header(c, k, v) end)
    ForceSSL.call(conn, ForceSSL.init([]))
  end

  test "disabled: plain HTTP goes through untouched" do
    Application.put_env(:cherry, :force_ssl, false)

    conn = request("192.168.0.126")
    refute conn.halted
    assert Plug.Conn.get_resp_header(conn, "strict-transport-security") == []
  end

  test "enabled: plain HTTP is redirected to HTTPS" do
    Application.put_env(:cherry, :force_ssl, @ssl_opts)

    conn = request("api.cherry.example")
    assert conn.halted
    assert conn.status == 301
    assert Plug.Conn.get_resp_header(conn, "location") == ["https://api.cherry.example/healthz"]
  end

  test "enabled: HTTPS behind the proxy gets HSTS and goes through" do
    Application.put_env(:cherry, :force_ssl, @ssl_opts)

    conn = request("api.cherry.example", [{"x-forwarded-proto", "https"}])
    refute conn.halted
    assert [hsts] = Plug.Conn.get_resp_header(conn, "strict-transport-security")
    assert hsts =~ "max-age="
  end

  test "enabled: the container health check on localhost is not redirected" do
    Application.put_env(:cherry, :force_ssl, @ssl_opts)

    refute request("localhost").halted
  end
end
