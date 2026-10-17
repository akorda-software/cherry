defmodule CherryWeb.LegalControllerTest do
  use CherryWeb.ConnCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Legal.Policy

  setup do
    keys = [:public_legal, :instance, :legal_enforcement_enabled]
    previous = Map.new(keys, &{&1, Application.get_env(:cherry, &1)})

    on_exit(fn ->
      for {key, value} <- previous do
        if is_nil(value),
          do: Application.delete_env(:cherry, key),
          else: Application.put_env(:cherry, key, value)
      end
    end)

    Application.put_env(:cherry, :instance,
      operator: "Synthetic operator",
      contact_email: "legal-api@example.invalid",
      country: "ES"
    )

    Application.put_env(:cherry, :public_legal,
      address: "Synthetic address",
      tax_id: "TEST-NIF",
      registry: "Synthetic registry",
      approved: true
    )

    Application.put_env(:cherry, :legal_enforcement_enabled, true)
    user = user_fixture()
    %{user: user, authed: authed_conn_for_user(user)}
  end

  test "publication is authenticated, private and exactly versioned", %{authed: conn} do
    assert build_conn() |> get("/api/me/legal") |> response(401)
    response_conn = get(conn, "/api/me/legal")
    data = json_response(response_conn, 200)
    assert data["publication"]["fingerprint"] == Policy.fingerprint()
    assert length(data["publication"]["documents"]) == 7
    assert data["status"]["required"]
    refute data["status"]["accepted"]
    assert get_resp_header(response_conn, "cache-control") == ["private, no-store"]
  end

  test "bootstrap and rights stay available without accepting; social use requires consent", %{
    authed: conn
  } do
    assert conn |> get("/api/bootstrap") |> json_response(200) |> get_in(["legal", "accepted"]) ==
             false

    assert conn |> get("/api/me/cases") |> response(200)
    assert conn |> get("/api/me/notices") |> response(200)
    assert conn |> get("/api/me/profile") |> response(200)

    assert conn |> get("/api/discovery/feed") |> json_response(403) == %{
             "error" => "legal_acceptance_required"
           }

    assert conn |> put("/api/me/profile", %{"gender" => "woman"}) |> response(403)

    assert conn
           |> post("/api/me/legal", attributes())
           |> json_response(200)
           |> Map.fetch!("accepted")

    assert conn |> get("/api/bootstrap") |> json_response(200) |> get_in(["legal", "accepted"])
    # It now reaches the existing profile guard rather than the legal gate.
    refute conn |> get("/api/discovery/feed") |> json_response(404) == %{
             "error" => "legal_acceptance_required"
           }
  end

  test "changed versions and nonboolean consent cannot be recorded", %{authed: conn} do
    assert conn
           |> post("/api/me/legal", Map.put(attributes(), "sensitiveConsent", "true"))
           |> response(422)

    assert conn
           |> post("/api/me/legal", Map.put(attributes(), "fingerprint", "old"))
           |> response(409)

    Application.put_env(:cherry, :public_legal, approved: false)
    assert conn |> post("/api/me/legal", attributes()) |> response(503)
  end

  test "unaccepted targets are not visible or available for swipes", %{user: viewer} do
    other = user_fixture()
    a = complete_profile_fixture(viewer)
    b = complete_profile_fixture(other, %{gender: "woman"})
    {:ok, _} = Cherry.Legal.accept(viewer, attributes())
    assert {:error, :profile_not_found} = Cherry.Dating.Social.public_profile(a, b.id)
    assert {:error, :profile_not_found} = Cherry.Dating.Social.swipe(a, b.id, "like")
    {:ok, _} = Cherry.Legal.accept(other, attributes())
    assert {:ok, _} = Cherry.Dating.Social.public_profile(a, b.id)
  end

  defp attributes do
    p = Policy.publication()

    %{
      "version" => p.version,
      "fingerprint" => p.fingerprint,
      "termsAccepted" => true,
      "sensitiveConsent" => true,
      "adulthoodConfirmed" => true
    }
  end

  test "feed and likes omit nonconsenting targets; an existing socket cannot bypass loss of eligibility",
       %{user: viewer, authed: conn} do
    other = user_fixture()
    a = complete_profile_fixture(viewer)
    b = complete_profile_fixture(other, %{gender: "woman"})
    {:ok, _} = Cherry.Legal.accept(viewer, attributes())
    {:ok, %{profiles: profiles}} = Cherry.Dating.discovery_feed(a.id)
    refute Enum.any?(profiles, &(&1.id == b.id))
    {:ok, _} = Cherry.Legal.accept(other, attributes())
    {:ok, %{profiles: profiles}} = Cherry.Dating.discovery_feed(a.id)
    assert Enum.any?(profiles, &(&1.id == b.id))

    {:ok, _} =
      Cherry.Dating.record_swipe(%{
        actor_profile_id: b.id,
        target_profile_id: a.id,
        action_type: "like"
      })

    assert Cherry.Dating.Social.received_likes_count(a) == 1

    {:ok, %{match: match}} =
      Cherry.Dating.record_swipe(%{
        actor_profile_id: a.id,
        target_profile_id: b.id,
        action_type: "like"
      })

    conversation = Cherry.Repo.get_by!(Cherry.Dating.Conversation, match_id: match.id)
    assert Cherry.Dating.conversation_allows_messaging?(conversation.id, a.id)
    ["Bearer " <> token] = get_req_header(conn, "authorization")
    assert {:ok, _} = CherryWeb.UserSocket.connect(%{"token" => token}, %Phoenix.Socket{}, %{})

    Cherry.Repo.update!(
      Ecto.Changeset.change(Cherry.Repo.reload!(other), legal_policy_fingerprint: nil)
    )

    refute Cherry.Dating.conversation_allows_messaging?(conversation.id, a.id)
    assert {:error, :profile_not_found} = Cherry.Dating.Social.public_profile(a, b.id)

    Cherry.Repo.update!(
      Ecto.Changeset.change(Cherry.Repo.reload!(viewer), legal_policy_fingerprint: nil)
    )

    assert :error = CherryWeb.UserSocket.connect(%{"token" => token}, %Phoenix.Socket{}, %{})
  end
end
