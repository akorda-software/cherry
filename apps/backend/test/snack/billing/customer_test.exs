defmodule Snack.Billing.CustomerTest do
  use Snack.DataCase, async: true

  alias Snack.Accounts
  alias Snack.Billing.Customer

  describe "changeset/2" do
    test "valid with required fields" do
      changeset =
        Customer.changeset(%Customer{}, %{
          user_id: Ecto.UUID.generate(),
          stripe_customer_id: "cus_abc123",
          email: "user@example.com"
        })

      assert changeset.valid? == true
    end

    test "requires user_id" do
      changeset =
        Customer.changeset(%Customer{}, %{
          stripe_customer_id: "cus_abc123",
          email: "user@example.com"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).user_id
    end

    test "requires stripe_customer_id" do
      changeset =
        Customer.changeset(%Customer{}, %{
          user_id: Ecto.UUID.generate(),
          email: "user@example.com"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).stripe_customer_id
    end

    test "requires email" do
      changeset =
        Customer.changeset(%Customer{}, %{
          user_id: Ecto.UUID.generate(),
          stripe_customer_id: "cus_abc123"
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).email
    end

    test "enforces unique stripe_customer_id" do
      stripe_id = "cus_unique_#{System.unique_integer([:positive])}"

      {:ok, user1} = Accounts.create_user(%{email: "first@example.com", display_name: "First"})
      {:ok, user2} = Accounts.create_user(%{email: "second@example.com", display_name: "Second"})

      {:ok, _} =
        %Customer{}
        |> Customer.changeset(%{
          user_id: user1.id,
          stripe_customer_id: stripe_id,
          email: "first@example.com"
        })
        |> Repo.insert()

      {:error, changeset} =
        %Customer{}
        |> Customer.changeset(%{
          user_id: user2.id,
          stripe_customer_id: stripe_id,
          email: "second@example.com"
        })
        |> Repo.insert()

      assert "has already been taken" in errors_on(changeset).stripe_customer_id
    end
  end
end
