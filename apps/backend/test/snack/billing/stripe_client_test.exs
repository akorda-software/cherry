defmodule Snack.Billing.StripeClientTest do
  use ExUnit.Case, async: false

  alias Snack.Billing.StripeClient

  describe "behaviour conformance" do
    test "MockStripeClient implements all StripeClient callbacks" do
      behaviours = StripeClient.behaviour_info(:callbacks)

      for {fun, arity} <- behaviours do
        assert function_exported?(Snack.Billing.MockStripeClient, fun, arity),
               "MockStripeClient missing callback: #{fun}/#{arity}"
      end
    end
  end

  describe "MockStripeClient.create_customer/2" do
    test "returns a customer map with stripe_customer_id" do
      assert {:ok, %{stripe_customer_id: "cus_mock_" <> _}} =
               Snack.Billing.MockStripeClient.create_customer(%{email: "test@example.com"}, [])
    end
  end

  describe "MockStripeClient.create_payment_sheet_session/2" do
    test "returns payment sheet session data" do
      assert {:ok,
              %{
                customer_id: "cus_mock_1",
                customer_ephemeral_key_secret: "ek_mock_" <> _,
                payment_intent_client_secret: "pi_mock_secret_" <> _
              }} =
               Snack.Billing.MockStripeClient.create_payment_sheet_session(
                 %{customer_id: "cus_mock_1", amount_cents: 999, currency: "usd"},
                 []
               )
    end
  end

  describe "MockStripeClient.cancel_subscription/2" do
    test "returns cancellation confirmation" do
      assert {:ok, %{status: "canceling"}} =
               Snack.Billing.MockStripeClient.cancel_subscription("sub_mock_1", [])
    end
  end

  describe "MockStripeClient.list_prices/1" do
    test "returns a list of price maps" do
      assert {:ok, prices} = Snack.Billing.MockStripeClient.list_prices([])
      assert is_list(prices)
    end
  end
end
