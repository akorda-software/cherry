defmodule Cherry.ReleaseSeedTest do
  use Cherry.DataCase, async: false

  import ExUnit.CaptureLog

  alias Cherry.Dating.Tag
  alias Cherry.Dating.TagCatalog

  describe "TagCatalog.seed!/0 (bin/migrate, bin/seed)" do
    test "creates the catalog idempotently and deactivates legacy tags" do
      {:ok, legacy} =
        Cherry.Dating.create_tag(%{
          slug: "legacy-#{System.unique_integer()}",
          label: "Old",
          category: "test"
        })

      assert %{tags: 52, deactivated: deactivated} = TagCatalog.seed!()
      assert deactivated >= 1
      refute Repo.get!(Tag, legacy.id).is_active
      assert Repo.aggregate(from(t in Tag, where: t.is_active), :count) == 52

      assert %{tags: 52, deactivated: 0} = TagCatalog.seed!()
      assert Repo.aggregate(from(t in Tag, where: t.is_active), :count) == 52
      assert Repo.get_by!(Tag, slug: "music").emoji == "🎵"
    end
  end

  describe "Auth.warn_missing_audiences/0" do
    setup do
      previous = Application.get_env(:cherry, Cherry.Auth)
      on_exit(fn -> Application.put_env(:cherry, Cherry.Auth, previous) end)
      %{previous: previous}
    end

    defp providers(previous, google, apple) do
      Application.put_env(
        :cherry,
        Cherry.Auth,
        Keyword.put(previous, :providers, %{
          google: [module: Cherry.Identity.Providers.Google, audiences: google],
          apple: [module: Cherry.Identity.Providers.Apple, audiences: apple]
        })
      )
    end

    test "is loud when no provider has audiences", %{previous: previous} do
      providers(previous, [], [])
      log = capture_log(fn -> Cherry.Auth.warn_missing_audiences() end)
      assert log =~ "EVERY login will be rejected"
      assert log =~ "GOOGLE_WEB_CLIENT_ID"
    end

    test "names the provider without audiences", %{previous: previous} do
      providers(previous, [], ["app.cherry.mobile"])
      log = capture_log(fn -> Cherry.Auth.warn_missing_audiences() end)
      assert log =~ "google has no audiences"
      refute log =~ "apple"
    end

    test "is silent when every provider has audiences", %{previous: previous} do
      providers(previous, ["web.apps.googleusercontent.com"], ["app.cherry.mobile"])
      assert capture_log(fn -> Cherry.Auth.warn_missing_audiences() end) == ""
    end
  end
end
