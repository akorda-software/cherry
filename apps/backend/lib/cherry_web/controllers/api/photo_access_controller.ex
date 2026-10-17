defmodule CherryWeb.Controllers.Api.PhotoAccessController do
  use CherryWeb, :controller
  alias Cherry.Dating.{ProfilePhoto, Social.PublicProfiles}
  alias Cherry.Identity.AgeVerifications
  alias Cherry.Repo
  import Ecto.Query

  # The object key is NOT authorization. Every renewal rechecks current access.
  def create(conn, %{"storageKey" => key}) when is_binary(key) and byte_size(key) <= 512 do
    viewer = conn.assigns.current_profile
    user = conn.assigns.current_user

    photo =
      Repo.one(
        from(p in ProfilePhoto,
          where: p.storage_key == ^key and p.is_active and is_nil(p.storage_deleted_at)
        )
      )

    allowed? =
      viewer && photo &&
        (photo.profile_id == viewer.id or
           (is_nil(user.suspended_at) and
              (not AgeVerifications.required?() or AgeVerifications.verified?(user.id)) and
              match?({:ok, _}, PublicProfiles.public_profile(viewer, photo.profile_id))))

    if allowed? do
      case Cherry.Storage.R2.presign_get(photo.storage_key) do
        {:ok, url} -> json(conn, %{url: url, expiresAt: DateTime.add(DateTime.utc_now(), 300)})
        _ -> conn |> put_status(:service_unavailable) |> json(%{error: "storage_unavailable"})
      end
    else
      conn |> put_status(:not_found) |> json(%{error: "photo_not_found"})
    end
  end

  def create(conn, _), do: conn |> put_status(:not_found) |> json(%{error: "photo_not_found"})
end
