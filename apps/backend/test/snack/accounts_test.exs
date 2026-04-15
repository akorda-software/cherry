defmodule Snack.AccountsTest do
  use Snack.DataCase, async: true

  alias Snack.Accounts

  describe "create_user/1" do
    test "creates a canonical user record" do
      assert {:ok, user} =
               Accounts.create_user(%{
                 email: "user@example.com",
                 display_name: "User Example"
               })

      assert user.email == "user@example.com"
      assert user.display_name == "User Example"
    end

    test "rejects duplicate canonical emails" do
      assert {:ok, _user} =
               Accounts.create_user(%{
                 email: "duplicate@example.com",
                 display_name: "First"
               })

      assert {:error, changeset} =
               Accounts.create_user(%{
                 email: "duplicate@example.com",
                 display_name: "Second"
               })

      assert "has already been taken" in errors_on(changeset).email
    end
  end
end
