defmodule SnackWeb.Controllers.Api.BillingControllerTest do
  use SnackWeb.ConnCase, async: false

  import Ecto.Query

  alias Snack.Accounts
  alias Snack.Billing.Plan
  alias Snack.Billing.Subscription
  alias Snack.Repo
  alias Snack.Sessions

  setup do
    Application.put_env(:snack, :stripe_client, Snack.Billing.MockStripeClient)

    original_features = Application.get_env(:snack, :features)

    on_exit(fn ->
      if original_features do
        Application.put_env(:snack, :features, original_features)
      else
        Application.delete_env(:snack, :features)
      end
    end)

    {:ok, user} =
      Accounts.create_user(%{email: "billing_ctrl@example.com", display_name: "Billing Ctrl"})

    {:ok, plan} =
      %Plan{}
      |> Plan.changeset(%{
        name: "Pro",
        stripe_price_id: "price_ctrl_test",
        amount_cents: 999,
        currency: "usd",
        interval: "month"
      })
      |> Repo.insert()

    # Issue a session for auth token
    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "billing-ctrl-install",
        platform: "ios",
        device_name: "Test Device"
      })

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{user: user, plan: plan, authed_conn: authed_conn}
  end

  describe "GET /api/billing/plans" do
    test "returns plans list when flag enabled", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: true)

      conn = get(conn, "/api/billing/plans")
      assert %{"plans" => plans} = json_response(conn, 200)
      assert is_list(plans)
      assert length(plans) >= 1
    end

    test "returns 404 when flag disabled", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: false)

      conn = get(conn, "/api/billing/plans")
      assert conn.status == 404
    end
  end

  describe "POST /api/billing/subscribe" do
    test "creates payment sheet session", %{authed_conn: conn, plan: plan} do
      Application.put_env(:snack, :features, subscriptions: true)

      conn = post(conn, "/api/billing/subscribe", %{"planId" => plan.id})

      assert %{
               "customerId" => _,
               "customerEphemeralKeySecret" => _,
               "paymentIntentClientSecret" => _
             } = json_response(conn, 200)
    end

    test "returns 404 when flag disabled", %{authed_conn: conn, plan: plan} do
      Application.put_env(:snack, :features, subscriptions: false)

      conn = post(conn, "/api/billing/subscribe", %{"planId" => plan.id})
      assert conn.status == 404
    end
  end

  describe "POST /api/billing/cancel" do
    test "returns canceling state for active subscriptions", %{
      authed_conn: conn,
      user: user,
      plan: plan
    } do
      Application.put_env(:snack, :features, subscriptions: true)

      {:ok, _} = Snack.Billing.subscribe(user, plan.id)

      sub =
        Repo.one(from(s in Subscription, limit: 1, order_by: [desc: s.inserted_at]))

      sub
      |> Subscription.changeset(%{
        status: "active",
        stripe_event_id: "evt_ctrl_cancel_#{System.unique_integer([:positive])}"
      })
      |> Repo.update!()

      conn = post(conn, "/api/billing/cancel")
      assert %{"status" => "canceling"} = json_response(conn, 200)
    end

    test "returns 404 when no active subscription", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: true)

      conn = post(conn, "/api/billing/cancel")
      assert %{"error" => "not_found"} = json_response(conn, 404)
    end

    test "returns 404 when flag disabled", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: false)

      conn = post(conn, "/api/billing/cancel")
      assert conn.status == 404
    end
  end

  describe "GET /api/billing/subscription" do
    test "returns unsubscribed state", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: true)

      conn = get(conn, "/api/billing/subscription")
      assert %{"subscribed" => false} = json_response(conn, 200)
    end

    test "returns 404 when flag disabled", %{authed_conn: conn} do
      Application.put_env(:snack, :features, subscriptions: false)

      conn = get(conn, "/api/billing/subscription")
      assert conn.status == 404
    end
  end
end
