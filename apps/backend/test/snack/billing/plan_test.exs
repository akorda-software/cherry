defmodule Snack.Billing.PlanTest do
  use Snack.DataCase, async: true

  alias Snack.Billing.Plan

  describe "changeset/2" do
    test "valid with all required fields" do
      changeset =
        Plan.changeset(%Plan{}, %{
          name: "Pro",
          stripe_price_id: "price_abc123",
          amount_cents: 999,
          currency: "usd",
          interval: "month"
        })

      assert changeset.valid? == true
    end

    test "requires name" do
      changeset =
        Plan.changeset(%Plan{}, %{
          stripe_price_id: "price_abc123",
          amount_cents: 999,
          currency: "usd",
          interval: "month"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).name
    end

    test "requires stripe_price_id" do
      changeset =
        Plan.changeset(%Plan{}, %{
          name: "Pro",
          amount_cents: 999,
          currency: "usd",
          interval: "month"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).stripe_price_id
    end

    test "requires amount_cents" do
      changeset =
        Plan.changeset(%Plan{}, %{
          name: "Pro",
          stripe_price_id: "price_abc123",
          currency: "usd",
          interval: "month"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).amount_cents
    end

    test "requires currency" do
      changeset =
        Plan.changeset(%Plan{}, %{
          name: "Pro",
          stripe_price_id: "price_abc123",
          amount_cents: 999,
          interval: "month"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).currency
    end

    test "requires interval" do
      changeset =
        Plan.changeset(%Plan{}, %{
          name: "Pro",
          stripe_price_id: "price_abc123",
          amount_cents: 999,
          currency: "usd"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).interval
    end

    test "enforces unique stripe_price_id" do
      price_id = "price_unique_#{System.unique_integer([:positive])}"

      {:ok, _} =
        %Plan{}
        |> Plan.changeset(%{
          name: "Pro",
          stripe_price_id: price_id,
          amount_cents: 999,
          currency: "usd",
          interval: "month"
        })
        |> Repo.insert()

      {:error, changeset} =
        %Plan{}
        |> Plan.changeset(%{
          name: "Enterprise",
          stripe_price_id: price_id,
          amount_cents: 1999,
          currency: "usd",
          interval: "month"
        })
        |> Repo.insert()

      assert "has already been taken" in errors_on(changeset).stripe_price_id
    end
  end
end
