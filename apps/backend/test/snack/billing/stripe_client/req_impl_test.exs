defmodule Snack.Billing.StripeClient.ReqImplTest do
  use ExUnit.Case, async: false

  alias Snack.Billing.StripeClient.ReqImpl

  setup do
    original = Application.get_env(:snack, :stripe)

    Application.put_env(:snack, :stripe, %{
      base_url: "https://api.stripe.com",
      api_key: "sk_test_123"
    })

    on_exit(fn ->
      if original do
        Application.put_env(:snack, :stripe, original)
      else
        Application.delete_env(:snack, :stripe)
      end
    end)

    :ok
  end

  describe "create_customer/2" do
    test "returns error when Stripe API is unreachable" do
      result = ReqImpl.create_customer(%{email: "test@example.com"}, [])

      assert match?({:error, _}, result)
    end
  end

  describe "create_payment_sheet_session/2" do
    test "returns error when Stripe API is unreachable" do
      result =
        ReqImpl.create_payment_sheet_session(
          %{customer_id: "cus_1", amount_cents: 999, currency: "usd"},
          []
        )

      assert match?({:error, _}, result)
    end
  end

  describe "cancel_subscription/2" do
    test "returns error when Stripe API is unreachable" do
      result = ReqImpl.cancel_subscription("sub_1", [])

      assert match?({:error, _}, result)
    end
  end

  describe "list_prices/1" do
    test "returns error when Stripe API is unreachable" do
      result = ReqImpl.list_prices([])

      assert match?({:error, _}, result)
    end
  end

  describe "stripe config" do
    test "reads api_key and base_url from app env" do
      config = ReqImpl.stripe_config()
      assert config.api_key == "sk_test_123"
      assert config.base_url == "https://api.stripe.com"
    end
  end
end
