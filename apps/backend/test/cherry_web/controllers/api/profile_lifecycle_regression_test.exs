defmodule CherryWeb.Controllers.Api.ProfileLifecycleRegressionTest do
  use CherryWeb.ConnCase, async: true

  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Dating

  test "an edit that invalidates completeness returns the persisted visibility state" do
    user = user_fixture()
    profile = complete_profile_fixture(user)
    assert profile.is_complete

    response =
      user
      |> authed_conn_for_user()
      |> put("/api/me/profile", %{bio: nil})
      |> json_response(200)

    assert response["profile"]["isComplete"] == false
    assert response["profile"]["isDiscoverable"] == false
    assert Dating.get_profile(profile.id).is_complete == false
  end

  test "moderation can disable an unfinished draft" do
    {:ok, profile} = Dating.upsert_profile_for_user(user_fixture().id)

    assert {:ok, disabled} = Dating.disable_profile(profile)
    assert disabled.is_paused
    refute disabled.is_discoverable
  end
end
