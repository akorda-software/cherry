defmodule Cherry.Accounts.Restrictions do
  @moduledoc "Account restriction persistence. Called inside the decision transaction, never owns casework or HTTP."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Dating.{Profile, Profiles}
  alias Cherry.Repo

  def suspend!(nil, _case_id), do: Repo.rollback(:subject_unavailable)

  def suspend!(user_id, case_id) do
    user = lock!(user_id)
    if user.deleted_at, do: Repo.rollback(:subject_unavailable)
    if user.suspended_at, do: Repo.rollback(:already_suspended)
    Repo.update!(Ecto.Changeset.change(user, suspended_at: now(), suspension_case_id: case_id))

    Repo.update_all(from(p in Profile, where: p.user_id == ^user_id),
      set: [is_discoverable: false]
    )
  end

  def restore!(nil, _case_id), do: Repo.rollback(:subject_unavailable)

  def restore!(user_id, case_id) do
    user = lock!(user_id)
    if user.suspension_case_id != case_id, do: Repo.rollback(:measure_changed)
    if user.deleted_at, do: Repo.rollback(:subject_unavailable)
    Repo.update!(Ecto.Changeset.change(user, suspended_at: nil, suspension_case_id: nil))

    case Repo.get_by(Profile, user_id: user.id) do
      nil ->
        :ok

      profile ->
        case Profiles.sync_completed_profile_state(profile) do
          {:ok, _} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end
    end
  end

  defp lock!(id),
    do:
      Repo.one(from(u in User, where: u.id == ^id, lock: "FOR UPDATE")) ||
        Repo.rollback(:subject_unavailable)

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
