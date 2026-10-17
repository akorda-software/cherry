defmodule Cherry.Casework.Inbox do
  @moduledoc "Owner-scoped reads. A notice grants only its recipient access, never the other party's statement."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Casework.{Case, Notice, Pagination}
  alias Cherry.Repo

  def list_for_user(%User{id: id}, offset \\ 0) do
    user_query(id)
    |> order_by([c], desc: c.inserted_at, desc: c.id)
    |> limit(50)
    |> offset(^Pagination.normalize(offset))
    |> Repo.all()
  end

  def get_for_user(%User{id: user_id}, id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         %Case{} = record <- Repo.one(from(c in user_query(user_id), where: c.id == ^id)) do
      {:ok, record}
    else
      _ -> {:error, :not_found}
    end
  end

  def notices(%User{id: user_id}, offset \\ 0) do
    Repo.all(
      from(n in Notice,
        where: n.user_id == ^user_id,
        order_by: [desc: n.inserted_at, desc: n.id],
        limit: 50,
        offset: ^Pagination.normalize(offset)
      )
    )
  end

  def appealed_ids(%User{id: user_id}, records) do
    ids = Enum.map(records, & &1.id)

    Repo.all(
      from(c in Case,
        where:
          c.kind == "appeal" and c.requester_user_id == ^user_id and c.parent_case_id in ^ids,
        select: c.parent_case_id
      )
    )
    |> MapSet.new()
  end

  def read_notice(%User{id: user_id}, id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         %Notice{} <- Repo.get_by(Notice, id: id, user_id: user_id) do
      # Preserve the first read time on retries.
      Repo.update_all(
        from(n in Notice, where: n.id == ^id and n.user_id == ^user_id and is_nil(n.read_at)),
        set: [read_at: DateTime.utc_now() |> DateTime.truncate(:second)]
      )

      {:ok, :read}
    else
      _ -> {:error, :not_found}
    end
  end

  defp user_query(user_id) do
    from(c in Case,
      where:
        c.requester_user_id == ^user_id or
          c.id in subquery(from(n in Notice, where: n.user_id == ^user_id, select: n.case_id))
    )
  end
end
